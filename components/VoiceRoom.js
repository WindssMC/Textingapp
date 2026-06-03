import { useEffect, useRef, useState } from "react";
import { db } from "../lib/firebase";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  onSnapshot,
} from "firebase/firestore";

export default function VoiceRoom({ serverId, user }) {
  const localRef = useRef();
  const remoteRef = useRef();
  const pcRef = useRef(null);
  const [inCall, setInCall] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [roomId, setRoomId] = useState(null);

  const startLocalStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    if (localRef.current) localRef.current.srcObject = stream;
    return stream;
  };

  const createRoom = async () => {
    setIsHost(true);
    setInCall(true);
    const stream = await startLocalStream();
    const pc = new RTCPeerConnection();
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    const roomRef = doc(collection(db, "servers", serverId, "voiceRooms"));
    setRoomId(roomRef.id);
    const offerCandidates = collection(roomRef, "offerCandidates");
    const answerCandidates = collection(roomRef, "answerCandidates");

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(offerCandidates, event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      if (remoteRef.current) remoteRef.current.srcObject = event.streams[0];
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(roomRef, { offer: { type: offer.type, sdp: offer.sdp }, createdAt: Date.now() });

    onSnapshot(roomRef, async (snap) => {
      const data = snap.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const ansDesc = new RTCSessionDescription(data.answer);
        await pc.setRemoteDescription(ansDesc);
      }
    });

    onSnapshot(answerCandidates, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const c = change.doc.data();
          pc.addIceCandidate(new RTCIceCandidate(c));
        }
      });
    });

    alert("Room created. Share Room ID: " + roomRef.id + " with others to join.");
  };

  const joinRoom = async () => {
    const id = prompt("Enter Room ID to join");
    if (!id) return;
    const roomRef = doc(db, "servers", serverId, "voiceRooms", id);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return alert("Room not found");
    setRoomId(id);
    setInCall(true);
    const stream = await startLocalStream();
    const pc = new RTCPeerConnection();
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    const offerCandidates = collection(roomRef, "offerCandidates");
    const answerCandidates = collection(roomRef, "answerCandidates");

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(answerCandidates, event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      if (remoteRef.current) remoteRef.current.srcObject = event.streams[0];
    };

    const roomData = roomSnap.data();
    const offerDesc = roomData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await setDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true });

    onSnapshot(offerCandidates, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const c = change.doc.data();
          pc.addIceCandidate(new RTCIceCandidate(c));
        }
      });
    });

    alert("Joined room " + id);
  };

  const leaveCall = async () => {
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((s) => { try { s.track?.stop?.(); } catch {} });
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localRef.current) localRef.current.srcObject = null;
    if (remoteRef.current) remoteRef.current.srcObject = null;
    setInCall(false);
    setRoomId(null);
    setIsHost(false);
  };

  return (
    <div className="card">
      <div>
        {!inCall ? (
          <>
            <button onClick={createRoom}>Create voice room (host)</button>
            <button className="ghost" onClick={joinRoom}>Join voice room</button>
          </>
        ) : (
          <button onClick={leaveCall}>Leave voice room</button>
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <div>
          <p>Your mic (local)</p>
          <audio ref={localRef} autoPlay muted />
        </div>
        <div>
          <p>Remote audio</p>
          <audio ref={remoteRef} autoPlay />
        </div>
        {roomId && <p>Room ID: {roomId}</p>}
      </div>
    </div>
  );
}

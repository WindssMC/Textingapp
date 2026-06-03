const isGithubPages = process.env.GITHUB_PAGES === 'true';
const basePath = isGithubPages ? '/Textingapp' : '';

module.exports = {
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
  reactStrictMode: true,
};

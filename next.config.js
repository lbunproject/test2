/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/stake',
        permanent: false,
      },
      {
        source: '/joe',
        destination: '/stake/joe',
        permanent: false,
      },
    ]
  },
}

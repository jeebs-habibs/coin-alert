import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Siren',
    short_name: 'Siren',
    description: 'An app for receiving alerts on your Solana memecoins',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/sirenLogo.png',
        sizes: '500x500',
        type: 'image/png',
      }
    ]
  }
}
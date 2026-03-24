import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div style={{
        width: 32, height: 32,
        background: 'linear-gradient(135deg, #dc2626, #7f1d1d)',
        borderRadius: 7,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontSize: 18, fontWeight: 800,
      }}>P</div>
    ),
    { width: 32, height: 32 }
  )
}

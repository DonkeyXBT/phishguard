import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div style={{
        width: 80, height: 80,
        background: 'linear-gradient(135deg, #dc2626, #7f1d1d)',
        borderRadius: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontSize: 44, fontWeight: 800,
      }}>P</div>
    ),
    { width: 80, height: 80 }
  )
}

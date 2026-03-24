import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div style={{
        width: 16, height: 16,
        background: 'linear-gradient(135deg, #dc2626, #7f1d1d)',
        borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontSize: 10, fontWeight: 800,
      }}>P</div>
    ),
    { width: 16, height: 16 }
  )
}

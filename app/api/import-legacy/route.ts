import { NextRequest, NextResponse } from 'next/server'
import { parseLegacyWorkbook, buildImportCandidates } from '@/lib/import-legacy'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const form = await req.formData()
    const file = form.get('file') as unknown as File
    const offsetStr = form.get('offset') as string | null
    const countStr = form.get('count') as string | null
    const seedLatStr = form.get('seedLat') as string | null
    const seedLngStr = form.get('seedLng') as string | null
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const rows = parseLegacyWorkbook(buffer)
    const total = rows.length

    const offset = Math.max(0, parseInt(offsetStr || '0', 10) || 0)
    const count = Math.max(1, Math.min(50, parseInt(countStr || '10', 10) || 10))

    const slice = rows.slice(offset, Math.min(offset + count, total))
    const seedLastKnown = seedLatStr && seedLngStr ? { lat: parseFloat(seedLatStr), lng: parseFloat(seedLngStr) } : undefined
    const { candidates, lastKnown } = await buildImportCandidates(slice, seedLastKnown)

    return NextResponse.json({ 
      success: true, 
      count: candidates.length, 
      total, 
      offset, 
      nextOffset: Math.min(offset + count, total),
      lastKnown,
      candidates 
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed to parse legacy sheet' }, { status: 500 })
  }
}

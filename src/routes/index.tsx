import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: ComingSoon,
})

function ComingSoon() {
  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Pitt Alumni Connect</h1>
        <p className="text-lg text-gray-400">Coming soon</p>
      </div>
    </div>
  )
}

import { Tweet } from 'react-tweet'

export default function Demo() {
  return (
    <div className="min-h-screen bg-agentvooc-secondary-bg dark:bg-agentvooc-secondary-bg">
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-4xl font-bold mb-4">Demo</h1>
        {/* Embed the tweet here */}
        <Tweet id="1950328560163443178" />
      </div>
    </div>
  )
}
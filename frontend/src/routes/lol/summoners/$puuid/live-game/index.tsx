import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/lol/summoners/$puuid/live-game/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/lol/summoners/$puuid/live-game/"!</div>
}

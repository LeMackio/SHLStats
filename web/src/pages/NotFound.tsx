import { Panel } from '@/components/site/Panel'

export function NotFound({ msg = 'Sidan finns inte.' }: { msg?: string }) {
  return (
    <Panel title="Hittades inte">
      <p>{msg}</p>
      <p><a href="#/">Till startsidan</a></p>
    </Panel>
  )
}

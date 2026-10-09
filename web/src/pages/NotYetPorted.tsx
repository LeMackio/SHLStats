import { Panel } from '@/components/site/Panel'

// Stand-in for the pages that are still being moved over from the original site
export function NotYetPorted({ name }: { name: string }) {
  return (
    <Panel title={name}>
      <p>Den här sidan flyttas just nu över till den nya versionen av SHLstats.</p>
      <p className="faint">Fram till dess finns den på den nuvarande sajten.</p>
    </Panel>
  )
}

export function NotFound({ msg = 'Sidan finns inte.' }: { msg?: string }) {
  return (
    <Panel title="Hittades inte">
      <p>{msg}</p>
      <p><a href="#/">Till startsidan</a></p>
    </Panel>
  )
}

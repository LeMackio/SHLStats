import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// Filter controls: shadcn/ui's Select and Input, dressed like the site's own fields
// (panel-coloured, borderless, the body font; taller with 16 px text on phones so iPhones don't zoom in)
const control = 'h-auto data-[size=default]:h-auto min-h-[29px] rounded-[6px] border-transparent bg-panel-2 px-2 py-1 font-sans text-[14px] font-medium normal-case tracking-normal text-foreground shadow-none dark:bg-panel-2 dark:hover:bg-panel-2 max-[700px]:min-h-[42px] max-[700px]:text-[16px]'

export function Field({ label, children, hidden }: { label: ReactNode; children: ReactNode; hidden?: boolean }) {
  return <label className="field" hidden={hidden}>{label} {children}</label>
}

export function FieldSelect<T extends string>({ value, onChange, options, label }: {
  value: T
  onChange: (v: T) => void
  options: [T, string][]
  label: string // for screen readers; the visible label is the Field's
}) {
  const items = Object.fromEntries(options)
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)} items={items}>
      <SelectTrigger aria-label={label} className={cn(control, 'gap-1 pr-1.5 [&>svg]:size-3.5!')}>
        {/* As wide as the longest option, like a native select, so the control doesn't change size with the choice */}
        <span className="grid">
          <SelectValue className="col-start-1 row-start-1" />
          {options.map(([v, l]) => <span key={v} aria-hidden="true" className="invisible col-start-1 row-start-1 h-0 overflow-hidden whitespace-nowrap">{l}</span>)}
        </span>
      </SelectTrigger>
      <SelectContent className="rounded-[10px] font-sans" alignItemWithTrigger={false} align="start">
        {options.map(([v, l]) => <SelectItem key={v} value={v} className="py-1.5 text-[14px]">{l}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function FieldInput({ className, ...props }: React.ComponentProps<'input'>) {
  return <Input className={cn(control, 'w-auto focus-visible:ring-2', className)} {...props} />
}

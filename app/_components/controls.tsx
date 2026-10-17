"use client";
// Drawn controls (FR-ONB-9g): react-aria's accessible Select and DatePicker, styled with the AXLE tokens.
// Each carries a name, so it submits with a plain form like any field.
import { I18nProvider, Button, Calendar, CalendarCell, CalendarGrid, DateInput, DatePicker, DateSegment, Dialog, Group, Heading, Label, ListBox, ListBoxItem, ListBoxSection, Header, Popover, Select, SelectValue } from "react-aria-components";
import { parseDate, today, getLocalTimeZone, type DateValue } from "@internationalized/date";
import { useFormStatus } from "react-dom";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";

const Chev = () => <svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;

export interface Option { id: string; label: string; group?: string; disabled?: boolean }

export function SelectField(p: { name: string; label: string; options: Option[]; defaultValue?: string | null; placeholder?: string; hint?: string; required?: boolean; onChange?: (v: string) => void; hideLabel?: boolean }) {
  const groups = [...new Set(p.options.map((o) => o.group ?? ""))];
  const item = (o: Option) => <ListBoxItem key={o.id} id={o.id} textValue={o.label} isDisabled={o.disabled} className="ra-option">{o.label}</ListBoxItem>;
  return (
    <Select className="ra-select" name={p.name} defaultValue={p.defaultValue ?? undefined} placeholder={p.placeholder ?? "Choose"} isRequired={p.required}
      onChange={(k) => p.onChange?.(String(k ?? ""))}>
      <Label className={p.hideLabel ? "sr-only" : "label"} style={{ fontSize: 13, fontWeight: 500, color: "var(--axle-text-strong)" }}>{p.label}</Label>
      <Button className="ra-trigger"><SelectValue className="ra-value" /><Chev /></Button>
      {p.hint ? <span className="hint" style={{ fontSize: 12, color: "var(--axle-text-muted)" }}>{p.hint}</span> : null}
      <Popover className="ra-popover" offset={6}>
        <ListBox className="ra-listbox">
          {groups.length > 1 || groups[0]
            ? groups.map((g) => <ListBoxSection key={g || "_"} id={g || "_"}><Header className="ra-section-h">{g}</Header>{p.options.filter((o) => (o.group ?? "") === g).map(item)}</ListBoxSection>)
            : p.options.map(item)}
        </ListBox>
      </Popover>
    </Select>
  );
}

export function DateField(p: { name: string; label: string; defaultValue?: string | null; max?: "today" | string; hint?: string; required?: boolean }) {
  const max = p.max === "today" ? today(getLocalTimeZone()) : p.max ? parseDate(p.max) : undefined;
  return (
    <I18nProvider locale="en-GB">
    <DatePicker className="ra-date" name={p.name} defaultValue={p.defaultValue ? parseDate(p.defaultValue) : undefined} maxValue={max} isRequired={p.required} shouldForceLeadingZeros>
      <Label style={{ fontSize: 13, fontWeight: 500, color: "var(--axle-text-strong)" }}>{p.label}</Label>
      <Group className="ra-group">
        <DateInput className="ra-input">{(seg) => <DateSegment segment={seg} className="ra-segment" />}</DateInput>
        <Button className="ra-cal-btn" aria-label="Open the calendar"><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg></Button>
      </Group>
      {p.hint ? <span style={{ fontSize: 12, color: "var(--axle-text-muted)" }}>{p.hint}</span> : null}
      <Popover className="ra-popover" offset={6}>
        <Dialog aria-label={p.label} style={{ outline: "none" }}>
          <Calendar<DateValue> className="ra-calendar">
            <header><Button slot="previous" className="ra-nav" aria-label="Previous month">‹</Button><Heading /><Button slot="next" className="ra-nav" aria-label="Next month">›</Button></header>
            <CalendarGrid>{(date) => <CalendarCell date={date} className="ra-cell" />}</CalendarGrid>
          </Calendar>
        </Dialog>
      </Popover>
    </DatePicker>
    </I18nProvider>
  );
}

export function Submit(p: { children: React.ReactNode; primary?: boolean; small?: boolean; name?: string; value?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" name={p.name} value={p.value} className={`btn${p.primary ? " primary" : ""}${p.small ? " sm" : ""}`} disabled={pending || p.disabled} aria-busy={pending}>{pending ? "Working…" : p.children}</button>;
}

export function CopyButton(p: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="btn sm" onClick={() => { navigator.clipboard.writeText(p.text).then(() => { setDone(true); setTimeout(() => setDone(false), 2000); }, () => {}); }}>{done ? "Copied" : p.label ?? "Copy"}</button>;
}

/** The organisation scope: one value in the address (?org=), so a copied link opens the same view (AXLE §19 Links). */
export function OrgPicker(p: { options: Option[]; current: string | null; label?: string }) {
  const router = useRouter(), path = usePathname(), params = useSearchParams();
  return (
    <div style={{ minWidth: 220 }}>
      <SelectField name="org" label={p.label ?? "Organisation"} hideLabel options={[{ id: "all", label: "All organisations" }, ...p.options]} defaultValue={p.current ?? "all"}
        onChange={(v) => { const q = new URLSearchParams(params.toString()); if (v === "all") q.delete("org"); else q.set("org", v); q.delete("id"); router.push(`${path}${q.size ? `?${q}` : ""}`); }} />
    </div>
  );
}

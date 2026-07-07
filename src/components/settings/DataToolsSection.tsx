import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Combine, Download, RotateCcw, Trash2, Upload } from 'lucide-react'
import { clearAllData, exportAllData, importAllData, mergeData } from '@/db/helpers'
import { restoreDefaults } from '@/db/seed'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// The Settings "Data" tools: export / import (replace) / merge / restore defaults
// / two-step clear-all. Self-contained (its own file inputs, confirm dialogs and
// handlers) so it lives outside the large SettingsScreen (CA2).
export function DataToolsSection() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const mergeFileRef = useRef<HTMLInputElement>(null)
  const [confirmImport, setConfirmImport] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmClear2, setConfirmClear2] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(false)

  async function handleExport() {
    try {
      const json = await exportAllData()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `workout-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      await importAllData(await file.text())
      toast.success('Data imported')
    } catch {
      toast.error('Import failed — is this a valid backup file?')
    }
  }

  async function handleMergeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const { inserted, skipped } = await mergeData(await file.text())
      toast.success(`Merge complete — ${inserted} records added, ${skipped} already existed`)
    } catch {
      toast.error('Merge failed — is this a valid backup file?')
    }
  }

  async function handleClearAll() {
    try {
      await clearAllData()
      setConfirmClear2(false)
      toast.success('All data cleared')
      navigate('/home')
    } catch {
      toast.error('Could not clear data')
    }
  }

  async function handleRestoreDefaults() {
    try {
      await restoreDefaults()
      setConfirmRestore(false)
      toast.success('Defaults restored')
    } catch {
      toast.error('Could not restore defaults')
    }
  }

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Data</h2>
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start" onClick={handleExport}>
            <Download className="size-4" /> Export data
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setConfirmImport(true)}
          >
            <Upload className="size-4" /> Import data
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => mergeFileRef.current?.click()}
          >
            <Combine className="size-4" /> Import and merge
          </Button>
          <p className="px-1 text-xs text-muted-foreground">
            Export downloads a JSON backup. Import replaces all current data; merge adds only
            records not already on this device.
          </p>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setConfirmRestore(true)}
          >
            <RotateCcw className="size-4" /> Restore defaults
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start text-destructive"
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 className="size-4" /> Clear all data
          </Button>
        </div>
      </section>

      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleFile} />
      <input
        ref={mergeFileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleMergeFile}
      />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your workouts, sessions, history, and planned
              workouts. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmClear(false)
                setConfirmClear2(true)
              }}
            >
              Clear data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClear2} onOpenChange={setConfirmClear2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure? This is permanent.</AlertDialogTitle>
            <AlertDialogDescription>
              Every workout, session, record, and planned workout will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleClearAll}
            >
              Yes, delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the original exercise library and workout templates. Any exercises
              or templates you have created or edited will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreDefaults}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmImport} onOpenChange={setConfirmImport}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces all workouts, templates, and records currently on this device. Consider
              exporting first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => fileRef.current?.click()}>Choose file</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

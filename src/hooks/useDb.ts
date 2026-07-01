// Thin re-export so screens depend on a local hook rather than reaching for the
// dexie-react-hooks package directly. Always wrap a db helper, never `db`.
export { useLiveQuery } from 'dexie-react-hooks'

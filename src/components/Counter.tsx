import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)

  return (
    <button
      type="button"
      onClick={() => setCount((value) => value + 1)}
      className="rounded-md bg-sky-500 px-4 py-2 font-medium text-slate-950 hover:bg-sky-400"
    >
      Count is {count}
    </button>
  )
}

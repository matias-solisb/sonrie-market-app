"use client"

import { MagnifyingGlass } from "@medusajs/icons"
import { useParams, useRouter } from "next/navigation"
import { FormEvent, useState } from "react"

const SearchBar = () => {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode: string }
  const [query, setQuery] = useState("")

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const trimmed = query.trim()
    const search = trimmed ? `?q=${encodeURIComponent(trimmed)}` : ""

    router.push(`/${countryCode}/products${search}`)
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="flex w-full items-stretch"
      data-testid="nav-search-form"
    >
      <input
        type="search"
        name="q"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar productos"
        className="h-10 w-full rounded-l-md border border-r-0 border-ui-border-base px-4 text-base-regular text-ui-fg-base placeholder:text-ui-fg-subtle focus:outline-none"
        data-testid="nav-search-input"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="flex h-10 items-center justify-center rounded-r-md bg-blue-900 px-4 text-white hover:bg-blue-800"
        data-testid="nav-search-submit"
      >
        <MagnifyingGlass />
      </button>
    </form>
  )
}

export default SearchBar

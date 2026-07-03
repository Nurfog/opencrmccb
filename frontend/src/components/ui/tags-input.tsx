"use client"

import { useState, useEffect, useRef } from "react"
import { X, Plus, Tag as TagIcon } from "lucide-react"
import { tagsApi, type Tag } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useI18n } from "@/contexts/i18n-context"

interface TagsInputProps {
  entityType: string
  entityId: string
  onChange?: () => void
}

export function TagsInput({ entityType, entityId, onChange }: TagsInputProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [entityTags, allTagsData] = await Promise.all([
          tagsApi.getForEntity(entityType, entityId),
          tagsApi.list(),
        ])
        setTags(entityTags)
        setAllTags(allTagsData)
      } catch {
        // Ignore errors
      }
    }
    fetchData()
  }, [entityType, entityId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredTags = allTags.filter(
    (tag) =>
      !tags.some((t) => t.id === tag.id) &&
      tag.name.toLowerCase().includes(inputValue.toLowerCase())
  )

  const handleAssign = async (tag: Tag) => {
    try {
      await tagsApi.assign(tag.id, entityType, entityId)
      setTags([...tags, tag])
      setInputValue("")
      setIsOpen(false)
      onChange?.()
    } catch {
      // Handle error
    }
  }

  const handleRemove = async (tag: Tag) => {
    try {
      await tagsApi.remove(tag.id, entityType, entityId)
      setTags(tags.filter((t) => t.id !== tag.id))
      onChange?.()
    } catch {
      // Handle error
    }
  }

  const handleCreate = async () => {
    if (!inputValue.trim()) return
    setLoading(true)
    try {
      const newTag = await tagsApi.create({ name: inputValue.trim() })
      setAllTags([...allTags, newTag])
      await handleAssign(newTag)
    } catch {
      // Handle error
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-1 p-1 border border-border rounded-md min-h-[38px] bg-background">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full"
            style={{ backgroundColor: tag.color + "20", color: tag.color }}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => handleRemove(tag)}
              className="hover:opacity-70"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && inputValue.trim()) {
              e.preventDefault()
              if (filteredTags.length > 0) {
                handleAssign(filteredTags[0])
              } else {
                handleCreate()
              }
            }
          }}
          placeholder={tags.length === 0 ? t("tags.placeholder") : ""}
          className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-sm px-1"
        />
      </div>

      {isOpen && (inputValue || filteredTags.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleAssign(tag)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </button>
          ))}
          {inputValue.trim() && !allTags.some((t) => t.name.toLowerCase() === inputValue.toLowerCase()) && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 text-muted-foreground"
            >
              <Plus className="h-4 w-4" />
              Create &quot;{inputValue}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface TagBadgeProps {
  tag: Tag
  onRemove?: () => void
}

export function TagBadge({ tag, onRemove }: TagBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full"
      style={{ backgroundColor: tag.color + "20", color: tag.color }}
    >
      {tag.name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:opacity-70">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

'use client'

import { useState } from 'react'
import { useCohostStore } from '@/lib/store'
import type { GuestWithDetails, PartifulStatus, HostVote } from '@/types'

const STATUS_COLORS: Record<PartifulStatus, string> = {
  approved: 'bg-[var(--color-status-approved)]/20 text-[var(--color-status-approved)]',
  pending: 'bg-[var(--color-status-pending)]/20 text-[var(--color-status-pending)]',
  waitlist: 'bg-yellow-500/20 text-yellow-400',
  rejected: 'bg-[var(--color-status-rejected)]/20 text-[var(--color-status-rejected)]',
  invited: 'bg-[var(--color-status-invited)]/20 text-[var(--color-status-invited)]',
  cant_go: 'bg-gray-500/20 text-gray-400',
}

const STATUS_LABELS: Record<PartifulStatus, string> = {
  approved: 'Approved',
  pending: 'Pending',
  waitlist: 'Waitlist',
  rejected: 'Rejected',
  invited: 'Invited',
  cant_go: "Can't Go",
}

const VOTE_COLORS: Record<HostVote, string> = {
  keep: 'bg-[var(--color-vote-keep)]',
  remove: 'bg-[var(--color-vote-remove)]',
  unsure: 'bg-[var(--color-vote-unsure)]',
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return minutes + 'm ago'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + 'h ago'
  const days = Math.floor(hours / 24)
  return days + 'd ago'
}

interface Props {
  guest: GuestWithDetails
}

export function GuestCard({ guest }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [commentText, setCommentText] = useState('')
  const { currentHost, submitVote, submitFlag, submitComment } = useCohostStore()
  
  const myVote = guest.votes.find(v => v.host_id === currentHost?.id)?.vote
  
  const handleVote = (vote: HostVote) => {
    submitVote(guest.id, vote)
  }
  
  const handleFlag = () => {
    submitFlag(guest.id, !guest.is_flagged)
  }
  
  const handleComment = () => {
    if (!commentText.trim()) return
    submitComment(guest.id, commentText)
    setCommentText('')
  }
  
  const initials = guest.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div 
      className={`
        bg-[var(--color-bg-card)] rounded-xl p-4 transition-all
        ${guest.has_conflict ? 'ring-2 ring-[var(--color-status-flagged)]/50' : ''}
        ${guest.is_flagged ? 'ring-2 ring-[#6365C0]/50' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {guest.photo ? (
          <img 
            src={guest.photo} 
            alt={guest.name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6365C0] to-[#73499D] flex items-center justify-center text-sm font-medium text-white">
            {initials}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[var(--color-text-primary)] truncate">
              {guest.name}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[guest.partiful_status]}`}>
              {STATUS_LABELS[guest.partiful_status]}
            </span>
            {guest.has_conflict && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-status-flagged)]/20 text-[var(--color-status-flagged)]">
                Conflict
              </span>
            )}
          </div>
          
          {guest.rsvp_timestamp && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              RSVP {timeAgo(guest.rsvp_timestamp)}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {guest.vote_summary.keep + guest.vote_summary.remove + guest.vote_summary.unsure > 0 && (
            <div className="flex gap-0.5 mr-2">
              {Array(guest.vote_summary.keep).fill(0).map((_, i) => (
                <div key={'k' + i} className={`w-2 h-2 rounded-full ${VOTE_COLORS.keep}`} />
              ))}
              {Array(guest.vote_summary.unsure).fill(0).map((_, i) => (
                <div key={'u' + i} className={`w-2 h-2 rounded-full ${VOTE_COLORS.unsure}`} />
              ))}
              {Array(guest.vote_summary.remove).fill(0).map((_, i) => (
                <div key={'r' + i} className={`w-2 h-2 rounded-full ${VOTE_COLORS.remove}`} />
              ))}
            </div>
          )}
          
          <button
            onClick={() => handleVote('keep')}
            className={`p-1.5 rounded-lg transition-colors ${
              myVote === 'keep' 
                ? 'bg-[var(--color-vote-keep)] text-white' 
                : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'
            }`}
            title="Keep"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          
          <button
            onClick={() => handleVote('unsure')}
            className={`p-1.5 rounded-lg transition-colors ${
              myVote === 'unsure' 
                ? 'bg-[var(--color-vote-unsure)] text-white' 
                : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'
            }`}
            title="Unsure"
          >
            <span className="text-sm font-medium">?</span>
          </button>
          
          <button
            onClick={() => handleVote('remove')}
            className={`p-1.5 rounded-lg transition-colors ${
              myVote === 'remove' 
                ? 'bg-[var(--color-vote-remove)] text-white' 
                : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'
            }`}
            title="Remove"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <button
            onClick={handleFlag}
            className={`p-1.5 rounded-lg transition-colors ${
              guest.is_flagged 
                ? 'text-[#6365C0]' 
                : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'
            }`}
            title={guest.is_flagged ? 'Unflag' : 'Flag for review'}
          >
            <svg className="w-4 h-4" fill={guest.is_flagged ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          </button>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors"
          >
            <svg 
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          {guest.votes.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-[var(--color-text-muted)] mb-2">Votes</p>
              <div className="flex flex-wrap gap-2">
                {guest.votes.map((v) => (
                  <div 
                    key={v.id}
                    className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                      v.vote === 'keep' ? 'bg-[var(--color-vote-keep)]/20 text-green-300' :
                      v.vote === 'remove' ? 'bg-[var(--color-vote-remove)]/20 text-red-300' :
                      'bg-[var(--color-vote-unsure)]/20 text-yellow-300'
                    }`}
                  >
                    <span>{v.host.name}</span>
                    <span>
                      {v.vote === 'keep' ? '✓' : v.vote === 'remove' ? '✗' : '?'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {guest.comments.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-[var(--color-text-muted)] mb-2">Comments</p>
              <div className="space-y-2">
                {guest.comments.map((c) => (
                  <div key={c.id} className="text-sm">
                    <span className="text-[var(--color-text-secondary)] font-medium">
                      {c.host.name}:
                    </span>{' '}
                    <span className="text-[var(--color-text-primary)]">{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleComment()}
              placeholder="Add a comment..."
              className="flex-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#6365C0]"
            />
            <button
              onClick={handleComment}
              disabled={!commentText.trim()}
              className="px-3 py-2 bg-[#6365C0] text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

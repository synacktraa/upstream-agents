"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Search, GitBranch, Loader2, Lock, Globe, ChevronDown, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchRepos, fetchBranches } from "@/lib/github"
import type { GitHubRepo, GitHubBranch } from "@/lib/types"

interface RepoPickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (repo: string, branch: string) => void
  isMobile?: boolean
}

type Step = "repo" | "branch"

export function RepoPickerModal({ open, onClose, onSelect, isMobile = false }: RepoPickerModalProps) {
  const { data: session } = useSession()

  const [step, setStep] = useState<Step>("repo")
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [branches, setBranches] = useState<GitHubBranch[]>([])
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string>("")
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [branchSearch, setBranchSearch] = useState("")

  // Fetch repos on open
  useEffect(() => {
    if (open && session?.accessToken) {
      setLoading(true)
      setError(null)
      fetchRepos(session.accessToken)
        .then(setRepos)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [open, session?.accessToken])

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setStep("repo")
      setSelectedRepo(null)
      setSelectedBranch("")
      setBranches([])
      setSearch("")
      setBranchSearch("")
      setShowBranchDropdown(false)
      setError(null)
    }
  }, [open])

  // Fetch branches when repo selected
  const handleSelectRepo = async (repo: GitHubRepo) => {
    if (!session?.accessToken) return

    setSelectedRepo(repo)
    setSelectedBranch(repo.default_branch)
    setStep("branch")
    setLoading(true)
    setError(null)
    setSearch("")

    try {
      const branchList = await fetchBranches(
        session.accessToken,
        repo.owner.login,
        repo.name
      )
      setBranches(branchList)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch branches")
    } finally {
      setLoading(false)
    }
  }

  // Handle branch selection from dropdown
  const handleSelectBranchFromDropdown = (branch: GitHubBranch) => {
    setSelectedBranch(branch.name)
    setShowBranchDropdown(false)
    setBranchSearch("")
  }

  // Handle OK button click
  const handleConfirm = () => {
    if (!selectedRepo || !selectedBranch) return
    onSelect(selectedRepo.full_name, selectedBranch)
    onClose()
  }

  // Filter items by search
  const filteredRepos = repos.filter((repo) =>
    repo.full_name.toLowerCase().includes(search.toLowerCase())
  )
  const filteredBranches = branches.filter((branch) =>
    branch.name.toLowerCase().includes(branchSearch.toLowerCase())
  )

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={cn(
          "fixed inset-0 z-50",
          isMobile ? "bg-background" : "bg-black/50"
        )} />
        <Dialog.Content className={cn(
          "fixed z-50 bg-popover overflow-hidden flex flex-col",
          isMobile
            ? "inset-0 rounded-none"
            : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md border border-border rounded-lg shadow-lg"
        )}>
          {/* Header */}
          <div className={cn(
            "flex items-center justify-between border-b border-border",
            isMobile ? "px-4 py-4 pt-safe" : "px-4 py-3"
          )}>
            <Dialog.Title className={cn(
              "font-semibold",
              isMobile ? "text-lg" : "text-sm"
            )}>
              {step === "repo" ? "Select Repository" : "Select Branch"}
            </Dialog.Title>
            <Dialog.Close className={cn(
              "rounded-lg hover:bg-accent active:bg-accent transition-colors touch-target",
              isMobile ? "p-2 -mr-2" : "p-1"
            )}>
              <X className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
            </Dialog.Close>
          </div>

          {/* Breadcrumb for branch step */}
          {step === "branch" && selectedRepo && (
            <div className={cn(
              "border-b border-border bg-muted/30",
              isMobile ? "px-4 py-3" : "px-4 py-2"
            )}>
              <button
                onClick={() => setStep("repo")}
                className={cn(
                  "flex items-center gap-1 text-muted-foreground hover:text-foreground active:text-foreground transition-colors",
                  isMobile ? "text-sm" : "text-xs"
                )}
              >
                <ChevronLeft className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
                Back to repositories
              </button>
              <div className={cn(
                "font-medium mt-1",
                isMobile ? "text-base" : "text-sm"
              )}>
                {selectedRepo.full_name}
              </div>
            </div>
          )}

          {/* Search - only for repo step */}
          {step === "repo" && (
            <div className={cn(
              "border-b border-border",
              isMobile ? "p-4" : "p-4"
            )}>
              <div className="relative">
                <Search className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground",
                  isMobile ? "h-5 w-5" : "h-4 w-4"
                )} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search repositories..."
                  className={cn(
                    "w-full bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring",
                    isMobile ? "pl-11 pr-4 py-3 text-base" : "pl-9 pr-4 py-2 text-sm"
                  )}
                />
              </div>
            </div>
          )}

          {/* Content */}
          <div className={cn(
            "flex-1 overflow-y-auto mobile-scroll",
            isMobile ? "max-h-none" : "max-h-80"
          )}>
            {error && (
              <div className={cn(
                "text-destructive text-center",
                isMobile ? "p-6 text-base" : "p-4 text-sm"
              )}>
                {error}
              </div>
            )}

            {loading && (
              <div className={cn(
                "flex items-center justify-center",
                isMobile ? "p-12" : "p-8"
              )}>
                <Loader2 className={cn(
                  "animate-spin text-muted-foreground",
                  isMobile ? "h-8 w-8" : "h-6 w-6"
                )} />
              </div>
            )}

            {!loading && !error && step === "repo" && (
              <div className={cn(isMobile ? "p-3" : "p-2")}>
                {filteredRepos.length === 0 ? (
                  <div className={cn(
                    "text-muted-foreground text-center",
                    isMobile ? "p-6 text-base" : "p-4 text-sm"
                  )}>
                    No repositories found
                  </div>
                ) : (
                  filteredRepos.map((repo) => (
                    <button
                      key={repo.id}
                      onClick={() => handleSelectRepo(repo)}
                      className={cn(
                        "flex items-center gap-3 w-full rounded-lg hover:bg-accent active:bg-accent transition-colors text-left touch-target",
                        isMobile ? "px-4 py-4" : "px-3 py-2"
                      )}
                    >
                      {repo.private ? (
                        <Lock className={cn(
                          "text-muted-foreground shrink-0",
                          isMobile ? "h-5 w-5" : "h-4 w-4"
                        )} />
                      ) : (
                        <Globe className={cn(
                          "text-muted-foreground shrink-0",
                          isMobile ? "h-5 w-5" : "h-4 w-4"
                        )} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          "font-medium truncate",
                          isMobile ? "text-base" : "text-sm"
                        )}>
                          {repo.full_name}
                        </div>
                        <div className={cn(
                          "text-muted-foreground",
                          isMobile ? "text-sm" : "text-xs"
                        )}>
                          Default: {repo.default_branch}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {!loading && !error && step === "branch" && (
              <div className={cn(isMobile ? "p-4" : "p-4")}>
                <div className={cn(isMobile ? "mb-6" : "mb-4")}>
                  <label className={cn(
                    "block font-medium mb-2",
                    isMobile ? "text-base" : "text-sm"
                  )}>
                    Base Branch
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                      className={cn(
                        "flex items-center justify-between w-full border border-border rounded-md hover:bg-accent/50 active:bg-accent transition-colors",
                        isMobile ? "px-4 py-3 text-base" : "px-3 py-2 text-sm"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <GitBranch className={cn(
                          "text-muted-foreground",
                          isMobile ? "h-5 w-5" : "h-4 w-4"
                        )} />
                        {selectedBranch}
                      </span>
                      <ChevronDown className={cn(
                        "text-muted-foreground",
                        isMobile ? "h-5 w-5" : "h-4 w-4"
                      )} />
                    </button>

                    {showBranchDropdown && (
                      <div className={cn(
                        "absolute left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-[200] overflow-y-auto",
                        isMobile ? "max-h-60" : "max-h-48"
                      )}>
                        {branches.length === 0 ? (
                          <div className={cn(
                            "text-muted-foreground text-center",
                            isMobile ? "p-4 text-base" : "p-2 text-sm"
                          )}>
                            No branches found
                          </div>
                        ) : (
                          branches.map((branch) => (
                            <button
                              key={branch.name}
                              onClick={() => handleSelectBranchFromDropdown(branch)}
                              className={cn(
                                "flex items-center gap-2 w-full text-left hover:bg-accent active:bg-accent transition-colors touch-target",
                                isMobile ? "px-4 py-3 text-base" : "px-3 py-2 text-sm",
                                branch.name === selectedBranch && "bg-accent"
                              )}
                            >
                              <GitBranch className={cn(
                                "text-muted-foreground",
                                isMobile ? "h-4 w-4" : "h-3 w-3"
                              )} />
                              {branch.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setStep("repo")}
                    className={cn(
                      "rounded-md hover:bg-accent active:bg-accent transition-colors touch-target",
                      isMobile ? "px-6 py-3 text-base" : "px-4 py-2 text-sm"
                    )}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={!selectedBranch}
                    className={cn(
                      "bg-primary text-primary-foreground rounded-md hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-50 touch-target",
                      isMobile ? "px-6 py-3 text-base" : "px-4 py-2 text-sm"
                    )}
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

"use client"

import type React from "react"
import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import UserMenu from "@/components/auth/UserMenu"
import { NewEntryTab } from "@/components/new-entry/NewEntryTab"
import { HistoryTab } from "@/components/history/HistoryTab"
import { GalleryTab } from "@/components/gallery/GalleryTab"

export default function TravelLog() {
  const [activeTab, setActiveTab] = useState("new-entry")

  return (
    <main className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex w-full flex-col items-center">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-4xl">
          <div className="flex items-center justify-between">
            <TabsList className="grid w-full max-w-sm grid-cols-3">
              <TabsTrigger value="new-entry">New Entry</TabsTrigger>
              <TabsTrigger value="gallery">Gallery</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <UserMenu />
          </div>
          <TabsContent value="new-entry" className="mt-6">
            <NewEntryTab />
          </TabsContent>

          <TabsContent value="gallery" className="mt-6">
            <GalleryTab />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

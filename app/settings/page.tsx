"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, AlertTriangle, ExternalLink, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Separator } from "@/components/ui/separator"

type GoogleConfigItem = {
  id: string;
  url: string | null;
  error?: string;
} | null;

type GoogleConfig = {
  sheet: GoogleConfigItem;
  folder: GoogleConfigItem;
};

export default function SettingsPage() {
  const router = useRouter();
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [googleConfig, setGoogleConfig] = useState<GoogleConfig>({ sheet: null, folder: null });

  useEffect(() => {
    const fetchConfig = async () => {
      setConfigLoading(true);
      setConfigError(null);
      try {
        const response = await fetch('/api/google/config');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch configuration.');
        }
        setGoogleConfig(data);
      } catch (err) {
        setConfigError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleCreateSheet = async () => {
    setSheetLoading(true);
    setSheetError(null);

    try {
      const response = await fetch("/api/google/create-sheet", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }
      
      setGoogleConfig(prev => ({
        ...prev,
        sheet: {
          id: data.spreadsheetId,
          url: data.spreadsheetUrl,
        }
      }));
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSheetLoading(false);
    }
  };
  
  const handleCreateFolder = async () => {
    setFolderLoading(true);
    setFolderError(null);

    try {
      const response = await fetch("/api/google/create-drive-folder", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }
      
      setGoogleConfig(prev => ({
        ...prev,
        folder: {
          id: data.folderId,
          url: data.folderUrl,
        }
      }));
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setFolderLoading(false);
    }
  };

  const renderStatus = (
    item: GoogleConfigItem,
    loading: boolean,
    createHandler: () => void,
    texts: { create: string; creating: string; open: string }
  ) => {
    if (item && item.url) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center">
            <CheckCircle className="mr-2 h-4 w-4" /> Connected
          </span>
          <Button asChild variant="outline" size="sm">
            <Link href={item.url} target="_blank">
              {texts.open}
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      );
    }

    return (
      <Button onClick={createHandler} disabled={loading || Boolean(item && !item.error)}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {texts.creating}
          </>
        ) : (
          texts.create
        )}
      </Button>
    );
  };

  const renderError = (error: string | null | undefined, itemError: string | null | undefined) => {
    const message = error || itemError;
    if (!message) return null;

    const isItemError = !!itemError;

    return (
      <div className={`rounded-md border p-3 ${isItemError ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
        <div className={`flex items-center gap-2 text-sm ${isItemError ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
          <AlertTriangle className="h-4 w-4" />
          <span className="font-semibold">{isItemError ? "Warning:" : "Error:"}</span>
          <span>{message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div className="flex items-center justify-between px-4 sm:px-0">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Button variant="outline" onClick={() => router.push("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to App
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Google Integration</CardTitle>
          <CardDescription>
            Manage your connection to Google services. Your data is stored securely in your own Google account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {configLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : configError ? (
            renderError(configError, null)
          ) : (
            <>
              {/* Google Sheets Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">WanderNote Spreadsheet</p>
                    <p className="text-sm text-muted-foreground">
                      Store your travel logs in a Google Sheet.
                    </p>
                  </div>
                  {renderStatus(googleConfig.sheet, sheetLoading, handleCreateSheet, {
                    create: "Create & Link Sheet",
                    creating: "Creating...",
                    open: "Open Sheet"
                  })}
                </div>
                {renderError(sheetError, googleConfig.sheet?.error)}
              </div>

              <Separator />

              {/* Google Drive Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">WanderNote Media Folder</p>
                    <p className="text-sm text-muted-foreground">
                      Store photos and videos in a dedicated folder.
                    </p>
                  </div>
                  {renderStatus(googleConfig.folder, folderLoading, handleCreateFolder, {
                    create: "Create & Link Folder",
                    creating: "Creating...",
                    open: "Open Folder"
                  })}
                </div>
                {renderError(folderError, googleConfig.folder?.error)}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 
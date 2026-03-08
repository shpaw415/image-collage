import {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
  type JSX,
} from "react";
import Cropper from "react-easy-crop";
import getCroppedImg from "../cropImage";
import { openDB } from "idb";
import { domToJpeg } from "modern-screenshot";

export async function getDb() {
  return openDB("collage-projects", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("projects")) {
        db.createObjectStore("projects", { keyPath: "id" });
      }
    },
  });
}

type TemplateType =
  | "single"
  | "grid-2"
  | "grid-4"
  | "row"
  | "col"
  | "split-left"
  | "split-right"
  | "split-top"
  | "split-bottom";

type PageSizeList =
  | "square"
  | "letter"
  | "a4"
  | "legal"
  | "letter-ls"
  | "a4-ls"
  | "4x6"
  | "4x6-ls"
  | "5x7"
  | "5x7-ls"
  | "3.5x5"
  | "3.5x5-ls";

const PAGE_DIMENSIONS: Record<PageSizeList, { width: number; height: number }> =
  {
    square: { width: 800, height: 800 },
    letter: { width: 816, height: 1056 }, // US Letter 8.5x11 inches @ 96 DPI
    a4: { width: 794, height: 1123 }, // A4 210x297 mm @ 96 DPI
    legal: { width: 816, height: 1344 }, // Legal 8.5x14 inches @ 96 DPI
    "letter-ls": { width: 1056, height: 816 }, // US Letter Landscape
    "a4-ls": { width: 1123, height: 794 }, // A4 Landscape
    "4x6": { width: 384, height: 576 }, // 4x6 inches @ 96 DPI
    "4x6-ls": { width: 576, height: 384 }, // 4x6 Landscape
    "5x7": { width: 480, height: 672 }, // 5x7 inches @ 96 DPI
    "5x7-ls": { width: 672, height: 480 }, // 5x7 Landscape
    "3.5x5": { width: 336, height: 480 }, // 3.5x5 inches @ 96 DPI
    "3.5x5-ls": { width: 480, height: 336 }, // 3.5x5 Landscape
  };

interface ImageItem {
  id: string;
  src: string;
}

const ProjectContext = createContext<ProjectProps>({} as ProjectProps);

async function urlToBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  return await response.blob();
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function useProject() {
  return useContext(ProjectContext);
}

type ProjectProps = {
  template: TemplateType;
  setTemplate: React.Dispatch<React.SetStateAction<TemplateType>>;
  collageImages: (ImageItem | null)[];
  setCollageImages: React.Dispatch<React.SetStateAction<(ImageItem | null)[]>>;
  uploadedImages: ImageItem[];
  setUploadedImages: React.Dispatch<React.SetStateAction<ImageItem[]>>;
  layoutOptions: LayoutOptions;
  updateLayoutOptions: (newValue: Partial<LayoutOptions>) => void;
  setEditingImageId: React.Dispatch<React.SetStateAction<string | null>>;
  editingImageId: string | null;
  pageSize: PageSizeList;
  setPageSize: React.Dispatch<React.SetStateAction<PageSizeList>>;
  getSlotCount: () => number;
  activeSlot: number | null;
  setActiveSlot: React.Dispatch<React.SetStateAction<number | null>>;
  setModale: React.Dispatch<React.SetStateAction<JSX.Element | null>>;
};

type LayoutOptions = {
  borderWidth: number;
  borderColor: string;
  margin: number;
};

export default function HomePage() {
  const [collageImages, setCollageImages] = useState<(ImageItem | null)[]>([]);
  const [uploadedImages, setUploadedImages] = useState<ImageItem[]>([]);
  const [template, setTemplate] = useState<TemplateType>("grid-4");
  const [pageSize, setPageSize] = useState<PageSizeList>("a4");
  const [layoutOptions, setLayoutOptions] = useState<LayoutOptions>({
    borderWidth: 0,
    borderColor: "#000000",
    margin: 0,
  });
  const [Modale, setModale] = useState<JSX.Element | null>(null);

  const updateLayoutOptions = useCallback(
    (newValue: Partial<LayoutOptions>) => {
      setLayoutOptions((prev) => ({ ...prev, ...newValue }));
    },
    [],
  );

  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);

  const getSlotCount = useCallback(() => {
    if (template === "single") return 1;
    if (template === "grid-2") return 2;
    if (template === "grid-4") return 4;
    if (
      template === "split-left" ||
      template === "split-right" ||
      template === "split-top" ||
      template === "split-bottom"
    )
      return 3;
    if (template === "row")
      return Math.max(3, collageImages.filter(Boolean).length + 1);
    if (template === "col")
      return Math.max(3, collageImages.filter(Boolean).length + 1);
    return 1;
  }, [template]);

  const getTemplateStyle = useCallback(() => {
    switch (template) {
      case "single":
        return { display: "grid", gridTemplateColumns: "1fr" };
      case "grid-2":
        return { display: "grid", gridTemplateColumns: "1fr 1fr" };
      case "grid-4":
      case "split-left":
      case "split-right":
      case "split-top":
      case "split-bottom":
        return {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
        };
      case "row":
        return { display: "flex", flexDirection: "row" as const };
      case "col":
        return { display: "flex", flexDirection: "column" as const };
      default:
        return {};
    }
  }, [template]);

  const getItemGridStyle = useCallback(
    (index: number) => {
      if (template === "split-left") {
        if (index === 0) return { gridArea: "1 / 1 / 2 / 2" };
        if (index === 1) return { gridArea: "2 / 1 / 3 / 2" };
        if (index === 2) return { gridArea: "1 / 2 / 3 / 3" };
      }
      if (template === "split-right") {
        if (index === 0) return { gridArea: "1 / 1 / 3 / 2" };
        if (index === 1) return { gridArea: "1 / 2 / 2 / 3" };
        if (index === 2) return { gridArea: "2 / 2 / 3 / 3" };
      }
      if (template === "split-top") {
        if (index === 0) return { gridArea: "1 / 1 / 2 / 3" };
        if (index === 1) return { gridArea: "2 / 1 / 3 / 2" };
        if (index === 2) return { gridArea: "2 / 2 / 3 / 3" };
      }
      if (template === "split-bottom") {
        if (index === 0) return { gridArea: "1 / 1 / 2 / 2" };
        if (index === 1) return { gridArea: "1 / 2 / 2 / 3" };
        if (index === 2) return { gridArea: "2 / 1 / 3 / 3" };
      }
      return {};
    },
    [template],
  );

  return (
    <ProjectContext.Provider
      value={{
        template,
        setTemplate,
        collageImages,
        setCollageImages,
        uploadedImages,
        setUploadedImages,
        layoutOptions,
        updateLayoutOptions,
        setEditingImageId,
        editingImageId,
        pageSize,
        setPageSize,
        getSlotCount,
        activeSlot,
        setActiveSlot,
        setModale,
      }}
    >
      <div className="flex flex-col-reverse md:flex-row h-dvh bg-gray-100 font-sans overflow-hidden print:h-auto print:overflow-visible print:block print:bg-white">
        <style>{`
          @media print {
            @page {
              margin: 0;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              margin: 0;
            }
          }
        `}</style>
        {/* Sidebar */}
        <SideBar />

        {/* Main Area */}
        <div
          className="flex-1 overflow-auto bg-gray-200 relative w-full h-full touch-auto print:overflow-visible print:bg-white print:p-0"
          onClick={() => setActiveSlot(null)}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const src = e.dataTransfer.getData("text/plain");
            if (src) {
              const slots = getSlotCount();
              const nextArr = [...collageImages];
              let found = false;
              for (let i = 0; i < slots; i++) {
                if (!nextArr[i]) {
                  nextArr[i] = { id: crypto.randomUUID(), src };
                  found = true;
                  break;
                }
              }
              if (found) {
                setCollageImages(nextArr);
              } else if (collageImages.length < getSlotCount()) {
                setCollageImages((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), src },
                ]);
              }
            }
          }}
        >
          <div className="min-h-full min-w-full flex items-center justify-center p-4 md:p-8 print:p-0 print:block">
            <div
              id="collage-export-target"
              className="shadow-lg transition-all relative bg-white print:shadow-none print:m-0 print:![max-width:none] print:w-[98%] print:mx-auto print:![height:auto] print:break-inside-avoid print:box-border"
              style={{
                ...getTemplateStyle(),
                gap: `${layoutOptions.margin}px`,
                padding: `${layoutOptions.margin}px`,
                border: `${layoutOptions.borderWidth}px solid ${layoutOptions.borderColor}`,
                backgroundColor: layoutOptions.borderColor,
                width: "100%",
                maxWidth: `${PAGE_DIMENSIONS[pageSize].width}px`,
                aspectRatio: `${PAGE_DIMENSIONS[pageSize].width} / ${PAGE_DIMENSIONS[pageSize].height}`,
              }}
            >
              {Array.from({ length: getSlotCount() }).map((_, index) => {
                const img = collageImages[index];
                const gridItemStyle = getItemGridStyle(index);

                if (img) {
                  return (
                    <div
                      key={img.id}
                      className={`relative overflow-hidden flex items-center justify-center bg-white min-h-[150px] min-w-[150px] h-full w-full cursor-pointer transition-all ${
                        activeSlot === index
                          ? "ring-4 ring-inset ring-blue-500"
                          : ""
                      }`}
                      style={gridItemStyle}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSlot(index);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const src = e.dataTransfer.getData("text/plain");
                        if (src) {
                          setCollageImages((prev) => {
                            const next = [...prev];
                            next[index] = { id: crypto.randomUUID(), src };
                            return next;
                          });
                          setActiveSlot(null);
                        }
                      }}
                    >
                      <img
                        src={img.src}
                        alt="Collage item"
                        className="object-cover w-full h-full pointer-events-none"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://via.placeholder.com/300?text=Error+Loading";
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCollageImages((prev) => {
                            const next = [...prev];
                            next[index] = null;
                            return next;
                          });
                        }}
                        className="absolute top-2 right-2 bg-black/50 text-white w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm hover:bg-black/80 z-10 print:hidden"
                        title="Remove Image"
                        data-hide-on-export="true"
                      >
                        ✕
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingImageId(img.id);
                        }}
                        className="absolute bottom-2 right-2 bg-black/50 text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm md:text-lg hover:bg-black/80 z-10 print:hidden"
                        title="Edit Image"
                        data-hide-on-export="true"
                      >
                        ✎
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={`empty-${index}`}
                    className={`flex flex-col items-center justify-center h-full w-full min-h-[150px] min-w-[150px] border-2 border-dashed transition-colors cursor-pointer ${
                      activeSlot === index
                        ? "border-blue-500 bg-blue-50 text-blue-500"
                        : "border-gray-300 bg-white/80 text-gray-400"
                    } print:opacity-0`}
                    style={gridItemStyle}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSlot(index);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const src = e.dataTransfer.getData("text/plain");
                      if (src) {
                        setCollageImages((prev) => {
                          const next = [...prev];
                          next[index] = { id: crypto.randomUUID(), src };
                          return next;
                        });
                        setActiveSlot(null);
                      }
                    }}
                  >
                    <span
                      className={`text-2xl md:text-3xl mb-1 ${
                        activeSlot === index ? "text-blue-500" : "text-gray-300"
                      }`}
                      data-hide-on-export="true"
                    >
                      📥
                    </span>
                    <p
                      className="text-xs md:text-sm font-medium text-center whitespace-pre-wrap"
                      data-hide-on-export="true"
                    >
                      {activeSlot === index
                        ? `Selected\n(Tap image to place)`
                        : `Tap to select\nor Drop`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Crop/Edit Modal */}
        {editingImageId && <CropModale />}
        {Modale && Modale}
      </div>
    </ProjectContext.Provider>
  );
}

function SideBar() {
  const {
    setUploadedImages,
    setTemplate,
    template,
    uploadedImages,
    setCollageImages,
    collageImages,
    pageSize,
    setPageSize,
    getSlotCount,
    activeSlot,
    setActiveSlot,
    layoutOptions,
    updateLayoutOptions,
    setModale,
  } = useProject();

  const [urlInput, setUrlInput] = useState("");

  const handleAddImage = (src: string) => {
    setUploadedImages((prev) => [...prev, { id: crypto.randomUUID(), src }]);
  };

  const handleUrlAdd = () => {
    if (urlInput.trim()) {
      handleAddImage(urlInput.trim());
      setUrlInput("");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            handleAddImage(event.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const [savedProjects, setSavedProjects] = useState<
    { id: string; name: string }[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const loadSavedProjectsList = useCallback(async () => {
    try {
      const db = await getDb();
      const all = await db.getAll("projects");
      setSavedProjects(all.map((p) => ({ id: p.id, name: p.name })));
    } catch (e) {
      console.error("Failed to load projects", e);
    }
  }, []);

  useEffect(() => {
    loadSavedProjectsList();
  }, [loadSavedProjectsList]);

  const handleSaveProject = async (saveAsNew = false) => {
    let projId = currentProjectId;
    let projectName = `Project ${new Date().toLocaleDateString()}`;

    if (saveAsNew || !projId) {
      const prompted = window.prompt(
        "Enter a name for your project:",
        projectName,
      );
      if (!prompted) return; // User cancelled or entered an empty name
      projectName = prompted;
      projId = Date.now().toString();
    } else {
      const existing = savedProjects.find((p) => p.id === projId);
      if (existing) {
        projectName = existing.name;
      } else {
        projId = Date.now().toString();
      }
    }

    setIsSaving(true);
    try {
      const db = await getDb();
      const newUploaded = await Promise.all(
        uploadedImages.map(async (img) => ({
          id: img.id,
          blob: await urlToBlob(img.src),
        })),
      );

      const newCollage = await Promise.all(
        collageImages.map(async (img) => {
          if (!img) return null;
          return { id: img.id, blob: await urlToBlob(img.src) };
        }),
      );

      await db.put("projects", {
        id: projId,
        name: projectName,
        template,
        pageSize,
        layoutOptions,
        uploadedImages: newUploaded,
        collageImages: newCollage,
      });
      setCurrentProjectId(projId);
      await loadSavedProjectsList();
      alert("Project saved successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to save project");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadProject = async (id: string) => {
    try {
      const db = await getDb();
      const proj = await db.get("projects", id);
      if (!proj) return;

      const restoreUploaded = await Promise.all(
        proj.uploadedImages.map(async (img: any) => ({
          id: img.id,
          src: await blobToDataUrl(img.blob),
        })),
      );

      const restoreCollage = await Promise.all(
        proj.collageImages.map(async (img: any) => {
          if (!img) return null;
          return { id: img.id, src: await blobToDataUrl(img.blob) };
        }),
      );

      setTemplate(proj.template);
      setPageSize(proj.pageSize);
      updateLayoutOptions(proj.layoutOptions);

      setUploadedImages(restoreUploaded);
      setCollageImages(restoreCollage);
      setCurrentProjectId(id);
    } catch (e) {
      console.error("Failed to load project", e);
      alert("Failed to load project");
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const db = await getDb();
      await db.delete("projects", id);
      if (currentProjectId === id) setCurrentProjectId(null);
      await loadSavedProjectsList();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveImage = async () => {
    const node = document.getElementById("collage-export-target");
    if (!node) return;
    try {
      const dataUrl = await domToJpeg(node, {
        scale: 2, // Better resolution
        backgroundColor: layoutOptions.borderColor,
        filter: (el: Node) => {
          // Hide specific UI elements (like edit/delete buttons) from the final exported image
          if (el instanceof Element) {
            return !el.hasAttribute("data-hide-on-export");
          }
          return true;
        },
      });

      const filename = `collage-${new Date().toISOString().split("T")[0]}.png`;

      // Try native share for iOS/Mobile "Save to Pictures"
      if (navigator.canShare) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], filename, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: "Collage",
            });
            return; // Exit here if native sharing succeeded
          }
        } catch (shareError: any) {
          // If the user cancelled the share native dialog, abort quietly without saving again
          if (shareError.name === "AbortError") return;
          console.warn(
            "Share API failed, falling back to download",
            shareError,
          );
        }
      }

      // Fallback for Desktop / non-share environments
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to save image", err);
      alert(
        "Failed to export image. Ensure all loaded images come from your device to prevent security rules blocking the export.",
      );
    }
  };

  return (
    <div className="w-full md:w-80 flex-shrink-0 bg-white p-4 md:p-6 shadow-md flex md:flex-col gap-4 md:gap-6 overflow-x-auto md:overflow-y-auto z-10 custom-scrollbar max-h-[30vh] md:max-h-none border-b md:border-b-0 md:border-r print:hidden">
      <div className="hidden md:block">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          🖼️ Collage Maker
        </h1>
      </div>

      {/* Projects */}
      <div className="flex flex-col gap-2 min-w-[200px] md:min-w-0 md:border-b md:pb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm md:text-lg font-semibold whitespace-nowrap">
            Projects
          </h2>
          <div className="flex gap-1">
            {currentProjectId && (
              <button
                onClick={() => handleSaveProject(false)}
                disabled={isSaving}
                className="text-[10px] md:text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? "..." : "Update"}
              </button>
            )}
            <button
              onClick={() => handleSaveProject(true)}
              disabled={isSaving}
              className="text-[10px] md:text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : currentProjectId ? "Save New" : "Save"}
            </button>
          </div>
        </div>
        {savedProjects.length > 0 && (
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar mt-1">
            {savedProjects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between text-xs bg-gray-50 p-1.5 border rounded"
              >
                <button
                  onClick={() => handleLoadProject(p.id)}
                  className="flex-1 text-left truncate hover:text-blue-600 font-medium"
                  title="Load Project"
                >
                  {p.name}
                </button>
                <button
                  onClick={() => handleDeleteProject(p.id)}
                  className="text-red-500 hover:text-red-700 ml-2 px-1"
                  title="Delete Project"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {savedProjects.length === 0 && (
          <p className="text-xs text-gray-400 italic">No saved projects yet</p>
        )}
      </div>

      {/* Inputs */}
      <div className="flex flex-col gap-2 min-w-[200px] md:min-w-0 md:border-b md:pb-6">
        <h2 className="text-sm md:text-lg font-semibold whitespace-nowrap">
          Import Images
        </h2>

        <div className="flex flex-col gap-1 md:gap-2">
          <label className="text-xs md:text-sm font-medium text-gray-700">
            From URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1 border p-1 md:p-2 rounded text-xs md:text-sm w-full"
              placeholder="https://..."
            />
            <button
              onClick={handleUrlAdd}
              className="bg-blue-600 text-white px-2 md:px-3 py-1 md:py-2 rounded text-xs md:text-sm font-medium hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1 md:gap-2 mt-1 md:mt-2">
          <label className="text-xs md:text-sm font-medium text-gray-700">
            Upload File
          </label>
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex items-center justify-center gap-2 bg-gray-50 border-2 border-gray-300 border-dashed rounded-lg p-4 hover:bg-gray-100 transition-colors text-gray-600 cursor-pointer group">
              <span className="text-xl group-hover:scale-110 transition-transform">
                📁
              </span>
              <span className="text-xs md:text-sm font-medium">
                Choose from device
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Imported Images Gallery */}
      <div className="flex flex-col gap-2 min-w-[200px] md:min-w-0 md:border-b md:pb-6 pl-4 border-l md:border-l-0 md:pl-0">
        <h2 className="text-sm md:text-lg font-semibold flex items-center justify-between whitespace-nowrap">
          <span>My Images</span>
          <span className="text-[10px] md:text-xs text-gray-400 font-normal bg-gray-100 px-1.5 md:px-2 py-0.5 rounded-full ml-2">
            {uploadedImages.length}
          </span>
        </h2>
        <p className="text-xs text-gray-500 mb-1">
          Drag and drop or <span className="md:hidden">tap</span>
          <span className="hidden md:inline">click</span> to add
        </p>

        <div className="flex md:grid md:grid-cols-3 gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
          {uploadedImages.map((img) => (
            <div
              key={img.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", img.src);
              }}
              onClick={() => {
                if (activeSlot !== null) {
                  setCollageImages((prev) => {
                    const next = [...prev];
                    next[activeSlot] = {
                      id: crypto.randomUUID(),
                      src: img.src,
                    };
                    return next;
                  });
                  setActiveSlot(null);
                } else {
                  const slots = getSlotCount();
                  const nextArr = [...collageImages];
                  let found = false;
                  for (let i = 0; i < slots; i++) {
                    if (!nextArr[i]) {
                      nextArr[i] = { id: crypto.randomUUID(), src: img.src };
                      found = true;
                      break;
                    }
                  }
                  if (found) {
                    setCollageImages(nextArr);
                  } else if (collageImages.length < getSlotCount()) {
                    setCollageImages((prev) => [
                      ...prev,
                      { id: crypto.randomUUID(), src: img.src },
                    ]);
                  }
                }
              }}
              className="relative w-16 h-16 md:w-auto md:h-auto md:aspect-square flex-shrink-0 border rounded bg-gray-50 cursor-pointer md:cursor-grab md:active:cursor-grabbing group overflow-hidden"
            >
              <img
                src={img.src}
                alt="Imported"
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setUploadedImages((prev) =>
                    prev.filter((i) => i.id !== img.id),
                  );
                }}
                className="absolute top-0.5 right-0.5 md:top-1 md:right-1 bg-black/60 text-white w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center text-[8px] md:text-[10px] opacity-100 transition-opacity hover:bg-black"
                title="Remove from sidebar"
              >
                ✕
              </button>
            </div>
          ))}
          {uploadedImages.length === 0 && (
            <div className="col-span-3 text-center py-4 md:py-6 text-xs md:text-sm text-gray-400 bg-gray-50 border border-dashed rounded whitespace-nowrap px-4">
              No images imported yet.
            </div>
          )}
        </div>
      </div>

      {/* Page Size & Templates */}
      <div className="flex flex-col gap-2 min-w-[150px] md:min-w-0 md:border-b md:pb-6 pl-4 border-l md:border-l-0 md:pl-0">
        <h2 className="text-sm md:text-lg font-semibold whitespace-nowrap">
          Canvas Layout
        </h2>

        <div className="flex flex-col gap-1 md:gap-2 mb-1 md:mb-2">
          <label className="text-xs md:text-sm font-medium text-gray-700">
            Page Size
          </label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(e.target.value as PageSizeList)}
            className="w-full border p-1 md:p-2 rounded text-xs md:text-sm"
          >
            <option value="square">Square 1:1</option>
            <option value="3.5x5">3.5" x 5"</option>
            <option value="3.5x5-ls">3.5" x 5" Landscape</option>
            <option value="4x6">4" x 6"</option>
            <option value="4x6-ls">4" x 6" Landscape</option>
            <option value="5x7">5" x 7"</option>
            <option value="5x7-ls">5" x 7" Landscape</option>
            <option value="letter">Letter (8.5" x 11")</option>
            <option value="letter-ls">Letter Landscape</option>
            <option value="a4">A4</option>
            <option value="a4-ls">A4 Landscape</option>
            <option value="legal">Legal</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 md:gap-2">
          <label className="text-xs md:text-sm font-medium text-gray-700">
            Grid Template
          </label>
          <select
            value={template}
            onChange={(e) => {
              setTemplate(e.target.value as TemplateType);
            }}
            className="w-full border p-1 md:p-2 rounded text-xs md:text-sm"
          >
            <option value="single">Single Image</option>
            <option value="grid-2">2-Grid</option>
            <option value="grid-4">4-Grid</option>
            <option value="split-left">Split Left</option>
            <option value="split-right">Split Right</option>
            <option value="split-top">Split Top</option>
            <option value="split-bottom">Split Bottom</option>
            <option value="row">Horizontal Row</option>
            <option value="col">Vertical Column</option>
          </select>
        </div>
      </div>

      {/* Customization */}
      <div className="flex flex-col gap-2 md:gap-4 md:border-b md:pb-6 min-w-[150px] md:min-w-0 pl-4 border-l md:border-l-0 md:pl-0">
        <h2 className="text-sm md:text-lg font-semibold whitespace-nowrap">
          Customization
        </h2>

        <div className="flex flex-col gap-1 md:gap-2">
          <div className="flex justify-between items-center">
            <label className="text-xs md:text-sm font-medium">
              Border Width
            </label>
            <button
              onClick={() => {
                setModale(<CustomizationModale type="border" />);
              }}
              className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-0.5 rounded font-mono"
            >
              {layoutOptions.borderWidth}px
            </button>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            value={layoutOptions.borderWidth}
            onChange={(e) =>
              updateLayoutOptions({ borderWidth: Number(e.target.value) })
            }
            className="w-full h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer touch-none"
          />
        </div>

        <div className="flex flex-col gap-1 md:gap-2">
          <label className="text-xs md:text-sm font-medium">Border Color</label>
          <input
            type="color"
            value={layoutOptions.borderColor}
            onChange={(e) =>
              updateLayoutOptions({ borderColor: e.target.value })
            }
            className="w-full h-8 md:h-10 border rounded cursor-pointer p-0"
          />
        </div>

        <div className="flex flex-col gap-1 md:gap-2">
          <div className="flex justify-between items-center">
            <label className="text-xs md:text-sm font-medium">
              Item Margin <span className="hidden md:inline">(Gap)</span>
            </label>
            <button
              onClick={() => {
                setModale(<CustomizationModale type="margin" />);
              }}
              className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-0.5 rounded font-mono"
            >
              {layoutOptions.margin}px
            </button>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            value={layoutOptions.margin}
            onChange={(e) =>
              updateLayoutOptions({ margin: Number(e.target.value) })
            }
            className="w-full h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer touch-none"
          />
        </div>
      </div>

      {collageImages.length > 0 && (
        <div className="md:mt-auto flex flex-col md:flex-row gap-2 min-w-[200px] mb-2 md:mb-0 ml-4 md:ml-0 self-center md:w-full md:self-stretch items-center print:hidden">
          <div className="flex flex-1 w-full gap-2">
            <button
              onClick={() => window.print()}
              className="flex-1 bg-green-100 text-green-700 py-1.5 md:py-2 rounded text-xs md:text-base font-medium hover:bg-green-200 whitespace-nowrap transition-colors"
            >
              🖨️ Print
            </button>
            <button
              onClick={handleSaveImage}
              className="flex-1 bg-blue-100 text-blue-700 py-1.5 md:py-2 rounded text-xs md:text-base font-medium hover:bg-blue-200 whitespace-nowrap transition-colors"
            >
              💾 Save
            </button>
          </div>
          <button
            onClick={() => setCollageImages([])}
            className="flex-1 md:flex-none w-full md:w-auto px-4 bg-red-100 text-red-700 py-1.5 md:py-2 rounded text-xs md:text-base font-medium hover:bg-red-200 whitespace-nowrap transition-colors"
          >
            Trash All
          </button>
        </div>
      )}
    </div>
  );
}

function CropModale() {
  const { setCollageImages, collageImages, editingImageId, setEditingImageId } =
    useProject();

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleSaveCrop = async () => {
    const editImg = collageImages.find((img) => img?.id === editingImageId);
    if (!editImg || !croppedAreaPixels) return;

    try {
      const croppedImage = await getCroppedImg(
        editImg.src,
        croppedAreaPixels,
        rotation,
      );
      if (croppedImage) {
        setCollageImages(
          collageImages.map((img) =>
            img?.id === editingImageId ? { ...img, src: croppedImage } : img,
          ),
        );
      }
      setEditingImageId(null);
      setRotation(0);
      setZoom(1);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col justify-end md:items-center md:justify-center z-50 p-0 md:p-4">
      <div className="bg-white p-5 md:p-6 rounded-t-2xl md:rounded-2xl w-full max-w-[600px] max-h-[95dvh] flex flex-col gap-4 md:gap-6 overflow-y-auto shadow-xl">
        <div className="md:hidden w-12 h-1.5 bg-gray-300 rounded-full mx-auto -mb-2" />
        <h2 className="text-lg md:text-xl font-bold text-center md:text-left">
          Crop & Rotate Image
        </h2>
        <div className="relative h-[45vh] min-h-[300px] md:h-[400px] w-full bg-gray-900 overflow-hidden rounded-xl">
          <Cropper
            image={collageImages.find((img) => img?.id === editingImageId)?.src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            onCropChange={setCrop}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className="flex flex-col gap-4 mt-2 md:mt-0">
          <div>
            <label className="text-sm font-medium flex justify-between mb-2">
              Zoom <span>{zoom.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div>
            <label className="text-sm font-medium flex justify-between mb-2">
              Rotation <span>{rotation}°</span>
            </label>
            <input
              type="range"
              value={rotation}
              min={0}
              max={360}
              step={1}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4 md:mt-2 pb-2 md:pb-0">
          <button
            onClick={() => setEditingImageId(null)}
            className="flex-1 md:flex-none px-4 py-3 md:py-2 border border-gray-300 rounded-xl hover:bg-gray-100 text-sm md:text-base font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveCrop}
            className="flex-1 md:flex-none px-4 py-3 md:py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-sm md:text-base transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomizationModale({ type }: { type: "border" | "margin" }) {
  const { updateLayoutOptions, layoutOptions, setModale } = useProject();
  const [customizationInput, setCustomizationInput] = useState(
    type === "border"
      ? layoutOptions.borderWidth.toString()
      : layoutOptions.margin.toString(),
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-100 p-4 text-left">
      <div className="bg-white rounded-xl p-5 w-[80%] max-w-[320px] shadow-2xl flex flex-col gap-4 mx-auto mt-[-10vh]">
        <h3 className="font-bold text-lg md:text-xl text-center">
          Set {type === "border" ? "Border Width" : "Item Margin"}
        </h3>
        <div className="flex bg-gray-100 p-2 rounded-lg items-center gap-2 border border-gray-300">
          <input
            type="number"
            value={customizationInput}
            onChange={(e) => setCustomizationInput(e.target.value)}
            className="w-full bg-transparent outline-none text-right text-lg font-mono flex-1 focus:ring-0 appearance-none"
            autoFocus
            placeholder="0"
            min="0"
            max="1000"
          />
          <span className="text-gray-500 font-mono text-sm mr-2 w-4">px</span>
        </div>

        <div className="flex gap-2 w-full mt-2">
          <button
            onClick={() => setModale(null)}
            className="flex-1 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const val = parseInt(customizationInput, 10);
              if (!isNaN(val)) {
                if (type === "border") {
                  updateLayoutOptions({
                    borderWidth: Math.max(0, val),
                  });
                } else {
                  updateLayoutOptions({
                    margin: Math.max(0, val),
                  });
                }
              }
              setModale(null);
            }}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Set Value
          </button>
        </div>
      </div>
    </div>
  );
}

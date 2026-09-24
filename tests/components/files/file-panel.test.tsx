// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FilePanel } from "@/components/files/file-panel";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("FilePanel component", () => {
  const mockFileVersions = [
    {
      id: "fv-1",
      versionNumber: 1,
      originalName: "design-v1.ai",
      uploadedById: "user-1",
      uploadedBy: { name: "Designer One" },
      note: "Initial design",
      status: "SUPERSEDED",
      approved: false,
      createdAt: new Date("2024-01-01T10:00:00Z"),
      fileObject: {
        id: "fo-1",
        sizeBytes: 1024 * 1024,
        mimeType: "application/vnd.adobe.illustrator",
        sha256: "a".repeat(64),
      },
    },
    {
      id: "fv-2",
      versionNumber: 2,
      originalName: "design-v2.ai",
      uploadedById: "user-1",
      uploadedBy: { name: "Designer One" },
      note: "Updated logo",
      status: "ACTIVE",
      approved: true,
      createdAt: new Date("2024-01-15T14:30:00Z"),
      fileObject: {
        id: "fo-2",
        sizeBytes: 2 * 1024 * 1024,
        mimeType: "application/vnd.adobe.illustrator",
        sha256: "b".repeat(64),
      },
    },
    {
      id: "fv-3",
      versionNumber: 3,
      originalName: "proof.pdf",
      uploadedById: "user-2",
      uploadedBy: { name: "Designer Two" },
      note: "Review copy",
      status: "ACTIVE",
      approved: false,
      createdAt: new Date("2024-02-01T09:00:00Z"),
      fileObject: {
        id: "fo-3",
        sizeBytes: 512 * 1024,
        mimeType: "application/pdf",
        sha256: "c".repeat(64),
      },
    },
  ];

  const mockWorkItem = {
    id: "wi-123",
    order: { customer: { name: "Test Client" } },
  };

  const defaultProps = {
    workItemId: "wi-123",
    categories: ["ORIGINAL", "DESIGN_VERSIONS", "REVIEW_PROOF", "APPROVED", "PRODUCTION", "SUPPORTING"],
    fileVersions: mockFileVersions,
    workItem: mockWorkItem,
    onDownload: vi.fn(),
    onUpload: vi.fn(),
    onVoid: vi.fn(),
    onArchive: vi.fn(),
    onApprove: vi.fn(),
    currentUser: { id: "user-1", permissions: new Set(["designer"]), departmentIds: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders six category tabs", () => {
    render(<FilePanel {...defaultProps} />);

    const categories = ["ORIGINAL", "DESIGN_VERSIONS", "REVIEW_PROOF", "APPROVED", "PRODUCTION", "SUPPORTING"];
    categories.forEach(category => {
      expect(screen.getByRole("tab", { name: category })).toBeInTheDocument();
    });
  });

  it("displays version list with correct columns", () => {
    render(<FilePanel {...defaultProps} />);

    expect(screen.getByText("Version")).toBeInTheDocument();
    expect(screen.getByText("Filename")).toBeInTheDocument();
    expect(screen.getByText("Uploader")).toBeInTheDocument();
    expect(screen.getByText("Timestamp")).toBeInTheDocument();
    expect(screen.getByText("Note")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Size")).toBeInTheDocument();
    expect(screen.getByText("MIME")).toBeInTheDocument();
    expect(screen.getByText("Checksum")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("shows version number, filename, uploader, timestamp, note, status, size, MIME, checksum summary, and approved state", () => {
    render(<FilePanel {...defaultProps} />);

    // Check first version row
    expect(screen.getByText("1")).toBeInTheDocument(); // version number
    expect(screen.getByText("design-v1.ai")).toBeInTheDocument(); // filename
    expect(screen.getByText("Designer One")).toBeInTheDocument(); // uploader
    expect(screen.getByText("SUPERSEDED")).toBeInTheDocument(); // status
    expect(screen.getByText("1 MB")).toBeInTheDocument(); // size
    expect(screen.getByText("application/vnd.adobe.illustrator")).toBeInTheDocument(); // MIME
    expect(screen.getByText("aaaaaaaa...")).toBeInTheDocument(); // checksum summary
    expect(screen.getByText("No")).toBeInTheDocument(); // approved
  });

  it("shows approved state correctly", () => {
    render(<FilePanel {...defaultProps} />);

    expect(screen.getByText("Yes")).toBeInTheDocument(); // v2 is approved
    expect(screen.getByText("No")).toBeInTheDocument(); // v1 and v3 are not
  });

  it("renders RTL layout with logical directional classes", () => {
    render(<FilePanel {...defaultProps} />);

    const panel = screen.getByTestId("file-panel");
    expect(panel).toHaveAttribute("dir", "rtl");
  });

  it("supports keyboard navigation between category tabs", () => {
    render(<FilePanel {...defaultProps} />);

    const designTab = screen.getByRole("tab", { name: "DESIGN_VERSIONS" });
    designTab.focus();
    expect(designTab).toHaveFocus();

    fireEvent.keyDown(designTab, { key: "ArrowLeft" }); // RTL: left goes to next
    const reviewTab = screen.getByRole("tab", { name: "REVIEW_PROOF" });
    expect(reviewTab).toHaveFocus();
  });

  it("shows loading state", () => {
    render(<FilePanel {...defaultProps} loading={true} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows empty state when no versions", () => {
    render(<FilePanel {...defaultProps} fileVersions={[]} />);

    expect(screen.getByText("No versions found")).toBeInTheDocument();
  });

  it("shows error state", () => {
    render(<FilePanel {...defaultProps} error="Failed to load versions" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Failed to load versions")).toBeInTheDocument();
  });

  it("shows validation error for void/archive without reason", () => {
    render(<FilePanel {...defaultProps} />);

    const voidButton = screen.getByRole("button", { name: /void/i });
    fireEvent.click(voidButton);

    // Modal should open
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();

    // Submit without reason
    const submitButton = screen.getByRole("button", { name: /confirm/i });
    fireEvent.click(submitButton);

    expect(screen.getByText(/reason is required/i)).toBeInTheDocument();
  });

  it("calls onDownload when download button clicked", () => {
    render(<FilePanel {...defaultProps} />);

    const downloadButton = screen.getByRole("button", { name: /download v2/i });
    fireEvent.click(downloadButton);

    expect(defaultProps.onDownload).toHaveBeenCalledWith("fv-2");
  });

  it("calls onUpload when upload button clicked", () => {
    render(<FilePanel {...defaultProps} />);

    const uploadButton = screen.getByRole("button", { name: /upload new version/i });
    fireEvent.click(uploadButton);

    expect(defaultProps.onUpload).toHaveBeenCalledWith("DESIGN_VERSIONS");
  });

  it("calls onVoid with reason when confirmed", () => {
    render(<FilePanel {...defaultProps} />);

    const voidButton = screen.getByRole("button", { name: /void v1/i });
    fireEvent.click(voidButton);

    const reasonInput = screen.getByLabelText(/reason/i);
    fireEvent.change(reasonInput, { target: { value: "Client rejected design" } });

    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    fireEvent.click(confirmButton);

    expect(defaultProps.onVoid).toHaveBeenCalledWith("fv-1", "Client rejected design");
  });

  it("calls onArchive with reason when confirmed", () => {
    render(<FilePanel {...defaultProps} />);

    const archiveButton = screen.getByRole("button", { name: /archive v1/i });
    fireEvent.click(archiveButton);

    const reasonInput = screen.getByLabelText(/reason/i);
    fireEvent.change(reasonInput, { target: { value: "Project completed" } });

    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    fireEvent.click(confirmButton);

    expect(defaultProps.onArchive).toHaveBeenCalledWith("fv-1", "Project completed");
  });

  it("calls onApprove when approve button clicked", () => {
    render(<FilePanel {...defaultProps} />);

    const approveButton = screen.getByRole("button", { name: /approve v1/i });
    fireEvent.click(approveButton);

    expect(defaultProps.onApprove).toHaveBeenCalledWith("fv-1");
  });

  it("shows image/PDF previews for previewable types", () => {
    render(<FilePanel {...defaultProps} />);

    // v2 is AI (not previewable), v3 is PDF (previewable)
    expect(screen.getByText("PDF Preview Available")).toBeInTheDocument();
  });

  it("shows metadata and icon for non-previewable types (AI/PSD/CDR)", () => {
    render(<FilePanel {...defaultProps} />);

    // v1 and v2 are AI files
    expect(screen.getByText("Preview not available")).toBeInTheDocument();
  });

  it("filters versions by category", () => {
    render(<FilePanel {...defaultProps} />);

    // Click REVIEW_PROOF tab
    const reviewTab = screen.getByRole("tab", { name: "REVIEW_PROOF" });
    fireEvent.click(reviewTab);

    // Should only show v3 (REVIEW_PROOF)
    expect(screen.getByText("proof.pdf")).toBeInTheDocument();
    expect(screen.queryByText("design-v1.ai")).not.toBeInTheDocument();
    expect(screen.queryByText("design-v2.ai")).not.toBeInTheDocument();
  });

  it("handles forbidden state", () => {
    render(<FilePanel {...defaultProps} forbidden={true} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });

  it("shows checksum summary (first 8 chars)", () => {
    render(<FilePanel {...defaultProps} />);

    expect(screen.getByText("aaaaaaaa...")).toBeInTheDocument();
    expect(screen.getByText("bbbbbbbb...")).toBeInTheDocument();
  });

  it("displays file size in human-readable format", () => {
    render(<FilePanel {...defaultProps} />);

    expect(screen.getByText("1 MB")).toBeInTheDocument();
    expect(screen.getByText("2 MB")).toBeInTheDocument();
    expect(screen.getByText("512 KB")).toBeInTheDocument();
  });

  it("displays timestamps in shop timezone", () => {
    render(<FilePanel {...defaultProps} />);

    // Should show formatted dates
    expect(screen.getByText(/Jan 1, 2024/i)).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 2024/i)).toBeInTheDocument();
  });
});
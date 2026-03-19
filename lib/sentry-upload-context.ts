import * as Sentry from "@sentry/nextjs"

type UploadFileLike = Pick<File, "name" | "type" | "size" | "arrayBuffer">

type ReadFileWithSentryContextInput = {
  route: string
  fieldName: string
  file: UploadFileLike
}

function buildUploadFileContext({
  route,
  fieldName,
  file,
}: ReadFileWithSentryContextInput) {
  return {
    route,
    fieldName,
    fileName: file.name || "(unknown)",
    fileType: file.type || "application/octet-stream",
    fileSize: Number.isFinite(file.size) ? file.size : null,
  }
}

export async function readFileWithSentryContext({
  route,
  fieldName,
  file,
}: ReadFileWithSentryContextInput): Promise<ArrayBuffer> {
  const context = buildUploadFileContext({ route, fieldName, file })

  Sentry.setContext("upload_file", context)
  Sentry.addBreadcrumb({
    category: "upload.read",
    message: `${route}:${fieldName}`,
    level: "info",
    data: context,
  })

  try {
    const buffer = await file.arrayBuffer()
    Sentry.setContext("upload_file", {
      ...context,
      phase: "arrayBuffer_complete",
      arrayBufferByteLength: buffer.byteLength,
    })
    return buffer
  } catch (error) {
    const failureContext = {
      ...context,
      phase: "arrayBuffer",
    }
    Sentry.setContext("upload_file", failureContext)
    Sentry.captureException(error, {
      contexts: {
        upload_file: failureContext,
      },
    })
    throw error
  }
}

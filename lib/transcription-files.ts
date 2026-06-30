export interface VideoMeta {
  title: string;
  views: number;
  likes: number;
  comments?: number;
  description: string;
  hashtags: string[] | string;
  videoUrl: string;
  publishDate: string;
}

export function sanitizeFilename(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 100);
}

const MONTH_ABBR = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export function buildFilePrefix(views: number, publishDate: string): string {
  let datePart = "";
  if (publishDate) {
    const d = new Date(publishDate);
    if (!isNaN(d.getTime())) {
      const mmm = MONTH_ABBR[d.getMonth()];
      const aa = String(d.getFullYear()).slice(-2);
      datePart = `${mmm}${aa}`;
    }
  }
  const v = views || 0;
  const tier = v >= 10_000_000 ? "1A" : v >= 1_000_000 ? "2A" : "3A";
  const viewsPart = String(v);
  return datePart ? `${tier}_${viewsPart}-${datePart}-` : `${tier}_${viewsPart}-`;
}

export function formatHashtags(hashtags: string[] | string): string {
  if (Array.isArray(hashtags)) {
    return hashtags.join(", ");
  }
  return String(hashtags || "");
}

export function buildTxtContent(meta: VideoMeta, transcript: string): string {
  return `Title: ${meta.title}

Description: ${meta.description}

Hashtags: ${formatHashtags(meta.hashtags)}

Transcription: ${transcript}

Views: ${meta.views.toLocaleString("en-US")}

Likes: ${meta.likes.toLocaleString("en-US")}

Link: ${meta.videoUrl}

Date: ${meta.publishDate}`;
}

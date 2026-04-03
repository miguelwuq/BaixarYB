"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { extractYouTubeVideoId } from "@/lib/youtube-link";
import styles from "./downloader-card.module.css";

type VideoFormat = {
  itag: number;
  qualityLabel: string;
  container: string;
  fps: number | null;
  approxSize: string;
  hasAudio: boolean;
  downloadToken: string;
};

type AudioFormat = {
  itag: number;
  audioLabel: string;
  container: string;
  approxSize: string;
  audioBitrate: number | null;
  downloadToken: string;
};

type VideoResponse = {
  videoId: string;
  title: string;
  channelName: string;
  channelUrl: string;
  channelAvatarUrl: string;
  channelVerified: boolean;
  thumbnailUrl: string;
  duration: string;
  videoFormats: VideoFormat[];
  audioFormats: AudioFormat[];
};

type DownloadMode = "audio" | "video";

type DownloadState = {
  status: "idle" | "downloading" | "done" | "error";
  progress: number;
  indeterminate: boolean;
  message: string | null;
};

const initialDownloadState: DownloadState = {
  status: "idle",
  progress: 0,
  indeterminate: false,
  message: null
};

export function DownloaderCard() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoResponse | null>(null);
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);
  const [downloadMode, setDownloadMode] = useState<DownloadMode>("audio");
  const [selectedVideoItag, setSelectedVideoItag] = useState<number | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState>(initialDownloadState);

  const selectedVideoFormat = useMemo(() => {
    if (!video) {
      return null;
    }

    return (
      video.videoFormats.find((format) => format.itag === selectedVideoItag) ??
      video.videoFormats[0] ??
      null
    );
  }, [selectedVideoItag, video]);

  const bestAudioFormat = video?.audioFormats[0] ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setVideo(null);
    setDownloadState(initialDownloadState);
    setPreviewVideoId(extractYouTubeVideoId(url));

    try {
      const response = await fetch("/api/video-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel carregar o video.");
      }

      setVideo(payload);
      setPreviewVideoId(payload.videoId);
      setDownloadMode(payload.audioFormats.length > 0 ? "audio" : "video");
      setSelectedVideoItag(payload.videoFormats[0]?.itag ?? null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Ocorreu um erro inesperado.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(token: string, fallbackName: string) {
    setDownloadState({
      status: "downloading",
      progress: 0,
      indeterminate: false,
      message: "Preparando download..."
    });

    try {
      const response = await fetch(
        `/api/download?token=${encodeURIComponent(token)}&stream=1`
      );

      if (!response.ok) {
        let message = "Nao foi possivel iniciar o download.";

        try {
          const payload = await response.json();
          message = payload.error ?? message;
        } catch {
          message = "Nao foi possivel iniciar o download.";
        }

        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("O navegador nao conseguiu ler o arquivo para baixar.");
      }

      const totalBytes = Number.parseInt(
        response.headers.get("content-length") || "0",
        10
      );
      const contentType =
        response.headers.get("content-type") || "application/octet-stream";
      const fileName =
        getFileNameFromHeader(response.headers.get("content-disposition")) ||
        fallbackName;

      const reader = response.body.getReader();
      const chunks: ArrayBuffer[] = [];
      let receivedBytes = 0;

      setDownloadState({
        status: "downloading",
        progress: 0,
        indeterminate: !Number.isFinite(totalBytes) || totalBytes <= 0,
        message: "Baixando arquivo..."
      });

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        if (!value) {
          continue;
        }

        chunks.push(
          value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer
        );
        receivedBytes += value.length;

        if (totalBytes > 0) {
          setDownloadState({
            status: "downloading",
            progress: Math.min((receivedBytes / totalBytes) * 100, 100),
            indeterminate: false,
            message: "Baixando arquivo..."
          });
        }
      }

      const blob = new Blob(chunks, { type: contentType });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      setDownloadState({
        status: "done",
        progress: 100,
        indeterminate: false,
        message: "Download concluido."
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Ocorreu um erro no download.";

      setDownloadState({
        status: "error",
        progress: 0,
        indeterminate: false,
        message
      });
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.adRail}>
          <div className={styles.adSlot}>
            <span className={styles.adLabel}>Anuncio</span>
            <strong className={styles.adTitle}>Google AdSense</strong>
            <p className={styles.adText}>Espaco lateral esquerdo para vincular o anuncio depois.</p>
          </div>
        </aside>

        <section className={styles.hero}>
          <div className={styles.badge}>Use apenas em conteudos que voce tem permissao para baixar.</div>
          <div className={styles.heroCopy}>
            <h1 className={styles.title}>
              <span className={styles.titleRow}>
                <span>YouTube</span>
                <span className={styles.titleBrand}>BaixarYB</span>
              </span>
              <span className={styles.titleSubline}>videos e converta para audios</span>
            </h1>
            <p className={styles.subtitle}>Cole um link do YouTube para comecar.</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <input
              type="url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className={styles.input}
              required
            />
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? "Buscando..." : "Buscar video"}
            </button>
          </form>

          <div className={styles.noteRow}>
            {video ? (
              <a href={video.channelUrl} target="_blank" rel="noreferrer" className={styles.noteChannel}>
                <span className={styles.avatar}>
                  <Image
                    src={video.channelAvatarUrl}
                    alt={video.channelName}
                    fill
                    sizes="40px"
                    style={{ objectFit: "cover" }}
                  />
                </span>
                <span>{video.channelName}</span>
              </a>
            ) : null}
          </div>

          {previewVideoId && !video ? (
            <section className={styles.previewShell}>
              <div className={styles.playerFrame}>
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${previewVideoId}`}
                  title="Preview do video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              {loading ? (
                <div className={styles.previewLoading}>
                  Carregando detalhes do video e opcoes de download...
                </div>
              ) : null}
            </section>
          ) : null}

          {error ? <div className={styles.error}>{error}</div> : null}

          {video ? (
            <article className={styles.card}>
              <div className={styles.preview}>
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${video.videoId}`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              <div className={styles.content}>
                <div className={styles.metaRow}>
                  <span className={styles.metaChip}>{video.duration}</span>
                  {video.channelVerified ? (
                    <span className={styles.verified}>Canal verificado</span>
                  ) : null}
                </div>

                <h2 className={styles.videoTitle}>{video.title}</h2>

                <div className={styles.modeTabs}>
                  <button
                    type="button"
                    className={downloadMode === "audio" ? styles.modeButtonActive : styles.modeButton}
                    onClick={() => {
                      setDownloadMode("audio");
                      setDownloadState(initialDownloadState);
                    }}
                  >
                    Audio
                  </button>
                  <button
                    type="button"
                    className={downloadMode === "video" ? styles.modeButtonActive : styles.modeButton}
                    onClick={() => {
                      setDownloadMode("video");
                      setDownloadState(initialDownloadState);
                    }}
                  >
                    Video
                  </button>
                </div>

                <section className={styles.actionPanel}>
                  {downloadMode === "audio" ? (
                    bestAudioFormat ? (
                      <>
                        <div className={styles.singleDownloadCard}>
                          <div>
                            <strong className={styles.downloadHeading}>Melhor audio disponivel</strong>
                            <p className={styles.downloadText}>
                              {bestAudioFormat.audioLabel} - {bestAudioFormat.container.toUpperCase()} -{" "}
                              {bestAudioFormat.approxSize}
                            </p>
                          </div>
                          <button
                            type="button"
                            className={styles.downloadPrimary}
                            disabled={downloadState.status === "downloading"}
                            onClick={() =>
                              handleDownload(
                                bestAudioFormat.downloadToken,
                                `${video.title} - audio.${bestAudioFormat.container}`
                              )
                            }
                          >
                            {downloadState.status === "downloading"
                              ? "Baixando audio..."
                              : "Baixar audio"}
                          </button>
                        </div>
                        <DownloadProgress state={downloadState} />
                      </>
                    ) : (
                      <p className={styles.emptyState}>
                        Esse video nao trouxe uma faixa de audio separada para download.
                      </p>
                    )
                  ) : (
                    <>
                      <div className={styles.sectionHead}>
                        <h3 className={styles.sectionTitle}>Escolha a qualidade do video</h3>
                        <span className={styles.sectionHint}>
                          Da maxima disponivel ate a minima
                        </span>
                      </div>

                      <div className={styles.qualityPicker}>
                        {video.videoFormats.map((format) => (
                          <button
                            type="button"
                            key={format.itag}
                            onClick={() => {
                              setSelectedVideoItag(format.itag);
                              setDownloadState(initialDownloadState);
                            }}
                            className={
                              selectedVideoFormat?.itag === format.itag
                                ? styles.qualityOptionActive
                                : styles.qualityOption
                            }
                          >
                            <strong>{format.qualityLabel}</strong>
                            <span>{format.container.toUpperCase()}</span>
                            <span>{format.fps ? `${format.fps} FPS` : "FPS padrao"}</span>
                            <span>{format.approxSize}</span>
                            <span>{format.hasAudio ? "Com audio" : "Sem audio"}</span>
                          </button>
                        ))}
                      </div>

                      {selectedVideoFormat ? (
                        <>
                          <div className={styles.singleDownloadCard}>
                            <div>
                              <strong className={styles.downloadHeading}>
                                Video selecionado: {selectedVideoFormat.qualityLabel}
                              </strong>
                              <p className={styles.downloadText}>
                                {selectedVideoFormat.container.toUpperCase()} -{" "}
                                {selectedVideoFormat.fps ? `${selectedVideoFormat.fps} FPS` : "FPS padrao"} -{" "}
                                {selectedVideoFormat.approxSize}
                              </p>
                            </div>
                            <button
                              type="button"
                              className={styles.downloadPrimary}
                              disabled={downloadState.status === "downloading"}
                              onClick={() =>
                                handleDownload(
                                  selectedVideoFormat.downloadToken,
                                  `${video.title} - ${selectedVideoFormat.qualityLabel}.${selectedVideoFormat.container}`
                                )
                              }
                            >
                              {downloadState.status === "downloading"
                                ? "Baixando video..."
                                : "Baixar video"}
                            </button>
                          </div>
                          {!selectedVideoFormat.hasAudio ? (
                            <p className={styles.warningText}>
                              Essa qualidade veio sem audio no mesmo arquivo. Isso acontece em algumas
                              resolucoes altas do YouTube.
                            </p>
                          ) : null}
                          <DownloadProgress state={downloadState} />
                        </>
                      ) : null}
                    </>
                  )}
                </section>
              </div>
            </article>
          ) : null}
        </section>

        <aside className={styles.adRail}>
          <div className={styles.adSlot}>
            <span className={styles.adLabel}>Anuncio</span>
            <strong className={styles.adTitle}>Google AdSense</strong>
            <p className={styles.adText}>Espaco lateral direito para vincular o anuncio depois.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function DownloadProgress({ state }: { state: DownloadState }) {
  if (state.status === "idle") {
    return null;
  }

  return (
    <div className={styles.progressBlock}>
      <div className={styles.progressMeta}>
        <span>{state.message}</span>
        {!state.indeterminate ? <span>{Math.round(state.progress)}%</span> : null}
      </div>
      <div className={styles.progressTrack}>
        <div
          className={state.indeterminate ? styles.progressFillIndeterminate : styles.progressFill}
          style={state.indeterminate ? undefined : { width: `${state.progress}%` }}
        />
      </div>
    </div>
  );
}

function getFileNameFromHeader(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const simpleMatch = contentDisposition.match(/filename="([^"]+)"/i);
  return simpleMatch?.[1] ?? null;
}

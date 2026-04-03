"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { extractYouTubeVideoId } from "@/lib/youtube-link";
import styles from "./downloader-card.module.css";

type VideoFormat = {
  itag: number;
  qualityLabel: string;
  container: string;
  fps: number | null;
  approxSize: string;
  downloadUrl: string;
};

type AudioFormat = {
  itag: number;
  audioLabel: string;
  container: string;
  approxSize: string;
  audioBitrate: number | null;
  downloadUrl: string;
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

export function DownloaderCard() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoResponse | null>(null);
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setVideo(null);
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
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Ocorreu um erro inesperado.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.badgeLogo}>
          <Image
            src="/yb-circle.svg"
            alt="Logo circular do BaixarYB"
            fill
            sizes="88px"
            priority
          />
        </div>
        <h1 className={styles.title}>Baixe videos do YouTube com qualidade escolhida</h1>
        <p className={styles.subtitle}>
          Cole o link, veja a capa, o nome do canal e escolha a qualidade de
          download disponivel.
        </p>

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

        <p className={styles.note}>
          Use apenas em conteudos que voce tem permissao para baixar.
        </p>

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
                <a href={video.channelUrl} target="_blank" rel="noreferrer" className={styles.channel}>
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
                  {video.channelVerified ? (
                    <span className={styles.verified}>Verificado</span>
                  ) : null}
                </a>
              </div>

              <h2 className={styles.videoTitle}>{video.title}</h2>

              <div className={styles.downloadColumns}>
                <section className={styles.downloadSection}>
                  <div className={styles.sectionHead}>
                    <h3 className={styles.sectionTitle}>Qualidade de video</h3>
                    <span className={styles.sectionHint}>
                      {video.videoFormats.length} opcoes
                    </span>
                  </div>
                  <div className={styles.qualityGrid}>
                    {video.videoFormats.map((format) => (
                      <a
                        key={format.itag}
                        href={format.downloadUrl}
                        className={styles.qualityLink}
                      >
                        <strong>{format.qualityLabel}</strong>
                        <span>{format.container.toUpperCase()}</span>
                        <span>{format.fps ? `${format.fps} FPS` : "FPS padrao"}</span>
                        <span>{format.approxSize}</span>
                      </a>
                    ))}
                  </div>
                </section>

                <section className={styles.downloadSection}>
                  <div className={styles.sectionHead}>
                    <h3 className={styles.sectionTitle}>Audio</h3>
                    <span className={styles.sectionHint}>
                      {video.audioFormats.length} opcoes
                    </span>
                  </div>
                  <div className={styles.audioGrid}>
                    {video.audioFormats.map((format) => (
                      <a
                        key={format.itag}
                        href={format.downloadUrl}
                        className={styles.audioLink}
                      >
                        <strong>{format.audioLabel}</strong>
                        <span>{format.container.toUpperCase()}</span>
                        <span>{format.audioBitrate ? `${format.audioBitrate} kbps` : "Bitrate padrao"}</span>
                        <span>{format.approxSize}</span>
                      </a>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </article>
        ) : null}
      </section>
    </main>
  );
}

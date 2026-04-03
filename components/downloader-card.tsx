"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import styles from "./downloader-card.module.css";

type VideoFormat = {
  itag: number;
  qualityLabel: string;
  container: string;
  fps: number | null;
  approxSize: string;
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
  formats: VideoFormat[];
};

export function DownloaderCard() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setVideo(null);

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
        <div className={styles.badge}>BaixarYB</div>
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

        {error ? <div className={styles.error}>{error}</div> : null}

        {video ? (
          <article className={styles.card}>
            <div className={styles.preview}>
              <Image
                src={video.thumbnailUrl}
                alt={video.title}
                fill
                sizes="(max-width: 900px) 100vw, 420px"
                style={{ objectFit: "cover" }}
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

              <div className={styles.qualityGrid}>
                {video.formats.map((format) => (
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
            </div>
          </article>
        ) : null}
      </section>
    </main>
  );
}

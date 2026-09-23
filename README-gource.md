# Gource Visualization

De ontwikkelhistorie van dit project in een film:

<video src="https://raw.githubusercontent.com/itsdarklikehell/clawhub/main/gource-720p.mp4" controls width="100%"></video>

_De video wordt automatisch gegenereerd door de [Gource workflow](.github/workflows/gource.yml) bij elke push._

Lokale video genereren (volledige history, 1080p 30fps):

```bash
gource --max-files 1500 --key -1920x1080 \
  --highlight-users --filename-time 3 --output-framerate 30 \
  -s 0.4 --multi-sampling --auto-skip-seconds 0.1 \
  --stop-at-end --hide mouse,progress,date,filenames \
  -o gource.ppm

ffmpeg -y -r 30 -f image2pipe -vcodec ppm -i gource.ppm \
  -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 192k gource.mp4

# Voor GitHub README: 720p versie (kleiner)
ffmpeg -y -i gource.mp4 -c:v libx264 -crf 20 -preset medium \
  -vf "scale=-1:720" -c:a aac -b:a 192k gource-720p.mp4
```

CI-workflow (wakker bij elke push):

```yaml
name: Gource visualization
on:
  push:
    branches: [main, master]
jobs:
  gource:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Gource
        uses: nbprojekt/gource-action@57256d303c5a9a5e72ed92ba13e3e83c5ec8b257
        with:
          gource_resolution: 1080p
          gource_fps: 60
          gource_filename_time: 3
          gource_hide_items: "mouse,date,filenames"
          gource_max_files: 1500
          gource_highlight_users: true
          gource_output_framerate: 30
          gource_stop_at_end: true
          gource_auto_skip_seconds: 0.1
          gource_multi_sampling: true
          gource_seconds_per_day: 0.4
      - name: Install ffmpeg
        run: sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg
      - name: Re-encode + 720p downscale voor GitHub
        run: |
          ffmpeg -y -i ./gource/gource.mp4 \
            -c:v libx264 -crf 18 -level 4.1 -preset medium -tune film \
            -filter:v "scale=-1:1080" -sws_flags lanczos \
            -c:a aac -b:a 192k -ar 48000 -movflags +faststart \
            ./gource.mp4
          ffmpeg -y -i ./gource.mp4 \
            -c:v libx264 -crf 20 -preset medium \
            -vf "scale=-1:720" -c:a aac -b:a 192k \
            gource-720p.mp4
      - name: Commit
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add gource.mp4 gource-720p.mp4 || true
          git diff --staged --quiet || git commit -m "ci: update gource visualization (automated)"
          git push
```

<script lang="ts" module>
  // Figuren und Deko als WebP. `small` lädt die Handy-Variante (halbe Kantenlänge).
  export type Art =
    | 'bear-wave'
    | 'bear-think'
    | 'bear-cheer'
    | 'bear-oops'
    | 'bear-trophy'
    | 'bear-clock'
    | 'bear-head'
    | 'herry-hey'
    | 'herry-laugh'
    | 'herry-tongue'
    | 'herry-swim'
    | 'herry-shock';
</script>

<script lang="ts">
  let {
    name,
    small = false,
    alt = '',
    class: cls = '',
  }: { name: Art | (string & {}); small?: boolean; alt?: string; class?: string } = $props();
</script>

<img class="sticker {cls}" src="/art/{name}{small ? '-s' : ''}.webp" {alt} decoding="async" draggable="false" />

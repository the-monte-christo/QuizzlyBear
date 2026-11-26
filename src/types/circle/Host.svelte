<script lang="ts">
  import ImageHost from '../_shared/ImageHost.svelte';
  import type { HostProps } from '../ui';

  let props: HostProps = $props();
</script>

<ImageHost {...props} mode="circle" />

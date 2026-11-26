<script lang="ts">
  import ScaleHost from '../_shared/ScaleHost.svelte';
  import type { HostProps } from '../ui';

  let props: HostProps = $props();
</script>

<ScaleHost {...props} mode="interval" />

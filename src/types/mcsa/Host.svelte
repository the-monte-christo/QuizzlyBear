<script lang="ts">
  import ChoiceHost from '../_shared/ChoiceHost.svelte';
  import type { HostProps } from '../ui';

  let props: HostProps = $props();
</script>

<ChoiceHost {...props} />

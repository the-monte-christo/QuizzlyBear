<script lang="ts">
  import ChoicePlayer from '../_shared/ChoicePlayer.svelte';
  import type { PlayerProps } from '../ui';

  let props: PlayerProps = $props();
</script>

<ChoicePlayer {...props} multi />

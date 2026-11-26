<script lang="ts" module>
  export type IconName =
    | 'check'
    | 'cross'
    | 'flame'
    | 'clock'
    | 'users'
    | 'play'
    | 'next'
    | 'lock'
    | 'phone'
    | 'expand'
    | 'gear'
    | 'drop'
    | 'up'
    | 'down'
    | 'grip'
    | 'wifi-off'
    | 'trash'
    | 'upload'
    | 'minus'
    | 'plus'
    | 'send';
</script>

<script lang="ts">
  let { name }: { name: IconName } = $props();
</script>

<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  {#if name === 'check'}
    <path class="s" d="M4.5 12.8l5 5L19.5 6.6" />
  {:else if name === 'cross'}
    <path class="s" d="M6 6l12 12M18 6L6 18" />
  {:else if name === 'flame'}
    <path class="f" d="M12.6 1.6c.5 3.6-1.3 5.3-3 7.2C7.9 10.6 6 12.600 6 15.600a6 6 0 0012 0c0-2.2-1-3.900-2.100-5.300-.3 1.500-1 2.500-2 3.100.5-3.600-.1-8.400-1.300-11.800z" />
  {:else if name === 'clock'}
    <circle class="o" cx="12" cy="13" r="8" /><path class="o" d="M12 8.500V13l3 2M9.500 2.500h5" />
  {:else if name === 'users'}
    <circle class="f" cx="8.500" cy="8" r="3.500" /><path class="f" d="M1.500 20c0-3.900 3.100-6.500 7-6.500s7 2.600 7 6.500z" /><circle class="f" cx="17" cy="9" r="2.800" /><path class="f" d="M17 13.300c3.200 0 5.500 2.300 5.500 5.700h-5.300c-.1-2.100-.900-3.900-2.300-5.200.6-.3 1.300-.5 2.100-.5z" />
  {:else if name === 'play'}
    <path class="f" d="M7 4.200v15.600a1 1 0 001.500.9l12.300-7.800a1 1 0 000-1.800L8.500 3.300A1 1 0 007 4.200z" />
  {:else if name === 'next'}
    <path class="s" d="M5 12h13M12.500 5.500L19 12l-6.500 6.500" />
  {:else if name === 'lock'}
    <rect class="f" x="4.500" y="10.500" width="15" height="10.500" rx="2.500" /><path class="o" d="M8 10.500V7.500a4 4 0 018 0v3" />
  {:else if name === 'phone'}
    <rect class="o" x="6.500" y="2.500" width="11" height="19" rx="2.500" /><path class="o" d="M10.500 18.300h3" />
  {:else if name === 'expand'}
    <path class="o" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  {:else if name === 'gear'}
    <circle class="o" cx="12" cy="12" r="3.200" /><path class="o" d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100" />
  {:else if name === 'drop'}
    <path class="f" d="M12 2.200c3.300 4.300 6.500 7.800 6.500 12a6.500 6.500 0 01-13 0c0-4.200 3.200-7.700 6.500-12z" />
  {:else if name === 'up'}
    <path class="s" d="M5.500 14.500L12 8l6.500 6.500" />
  {:else if name === 'down'}
    <path class="s" d="M5.500 9.500L12 16l6.500-6.500" />
  {:else if name === 'grip'}
    <path class="s" d="M5 8h14M5 12h14M5 16h14" />
  {:else if name === 'wifi-off'}
    <path class="o" d="M3 3l18 18M8.500 15.500a5 5 0 017 0M5 12a10 10 0 014-2.500M12.500 8.500A10 10 0 0119 12" /><circle class="f" cx="12" cy="19" r="1.300" />
  {:else if name === 'trash'}
    <path class="o" d="M4 6.500h16M9.500 6.500V4h5v2.500M6.500 6.500l1 14h9l1-14M10 10.500v6M14 10.500v6" />
  {:else if name === 'upload'}
    <path class="o" d="M12 16V4M7 9l5-5 5 5M4.500 16.500v3.500h15v-3.500" />
  {:else if name === 'minus'}
    <path class="s" d="M5.500 12h13" />
  {:else if name === 'plus'}
    <path class="s" d="M5.500 12h13M12 5.500v13" />
  {:else if name === 'send'}
    <path class="f" d="M3.200 3.600l18.300 7.500a1 1 0 010 1.800L3.200 20.400a.7.700 0 01-.9-.9L4.800 12 2.300 4.500a.7.700 0 01.9-.9z" />
  {/if}
</svg>

<style>
  .icon {
    display: inline-block;
    width: 1em;
    height: 1em;
    flex: none;
    vertical-align: -0.12em;
  }
  .s {
    fill: none;
    stroke: currentColor;
    stroke-width: 3.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .o {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .f {
    fill: currentColor;
  }
</style>

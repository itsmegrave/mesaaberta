<script lang="ts">
  import { m } from '#lib/paraglide/messages.js';

  // "ou" between the e-mail form and the provider buttons. Only drawn: the two are read one after
  // the other anyway.
</script>

<p class="flex items-center gap-3" aria-hidden="true">
  <span class="h-px grow bg-surface-200-800"></span>
  <span class="text-sm font-semibold text-muted">{m.login_or()}</span>
  <span class="h-px grow bg-surface-200-800"></span>
</p>

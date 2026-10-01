<script lang="ts">
  import { onMount } from 'svelte';
  import type { Editor } from '@tiptap/core';
  import Icon from './Icon.svelte';
  import type { IconName } from '$lib/icons/names';
  import { m } from '$lib/paraglide/messages';
  import { cleanRichHtml, richTextLength, toPlainText } from '$lib/text/rich';
  import './rich-text.css';

  // A WYSIWYG multiline field. `value` is the HTML subset of `$lib/text/rich`. Until the editor has
  // loaded (or without JavaScript) a plain <textarea> with the same `name` stands in for it: the
  // server turns plain text into paragraphs, so a native POST still saves.
  let {
    id,
    name,
    value = $bindable(),
    maxlength,
    rows = 4,
    invalid,
    describedby,
  }: {
    id: string;
    name: string;
    value?: string;
    /** What a reader sees, in characters; the server decides, this only warns. */
    maxlength: number;
    rows?: 3 | 4 | 5;
    invalid?: boolean | 'true';
    describedby?: string;
  } = $props();

  // Whole class names, so Tailwind sees them; an inline `style` would be blocked by the CSP.
  const MIN_HEIGHT = { 3: 'min-h-24', 4: 'min-h-32', 5: 'min-h-40' } as const;

  let host = $state<HTMLDivElement>();
  let toolbar = $state<HTMLDivElement>();
  let linkInput = $state<HTMLInputElement>();
  let editor = $state<Editor>();
  let ready = $state(false);
  // Bumped on every editor transaction, so the toolbar's pressed states are read again.
  let tick = $state(0);
  let linkOpen = $state(false);
  let linkUrl = $state('');
  let linkInvalid = $state(false);
  // The last HTML this component wrote to `value`, to tell an outside change from its own.
  let emitted = value ?? '';
  let stop = false;

  // A form that has not set the field yet passes nothing: it starts empty, as a bound <textarea> does.
  if (value === undefined) value = '';
  const html = $derived(value ?? '');
  const over = $derived(richTextLength(html) > maxlength);

  // Reading `tick` makes the toolbar's states follow the editor.
  const pressedOf = (tool: Tool) => {
    void tick;
    return Boolean(editor && tool.active?.(editor));
  };
  const disabledOf = (tool: Tool) => {
    void tick;
    return Boolean(editor && tool.disabled?.(editor));
  };

  type Tool = {
    icon: IconName;
    label: () => string;
    active?: (e: Editor) => boolean;
    run: (e: Editor) => void;
    disabled?: (e: Editor) => boolean;
  };

  const TOOLS: Tool[][] = [
    [
      {
        icon: 'bold',
        label: () => m.rich_text_bold(),
        active: (e) => e.isActive('bold'),
        run: (e) => e.chain().focus().toggleBold().run(),
      },
      {
        icon: 'italic',
        label: () => m.rich_text_italic(),
        active: (e) => e.isActive('italic'),
        run: (e) => e.chain().focus().toggleItalic().run(),
      },
      {
        icon: 'underline',
        label: () => m.rich_text_underline(),
        active: (e) => e.isActive('underline'),
        run: (e) => e.chain().focus().toggleUnderline().run(),
      },
      {
        icon: 'strikethrough',
        label: () => m.rich_text_strike(),
        active: (e) => e.isActive('strike'),
        run: (e) => e.chain().focus().toggleStrike().run(),
      },
    ],
    [
      {
        icon: 'heading-2',
        label: () => m.rich_text_heading_2(),
        active: (e) => e.isActive('heading', { level: 2 }),
        run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        icon: 'heading-3',
        label: () => m.rich_text_heading_3(),
        active: (e) => e.isActive('heading', { level: 3 }),
        run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
      },
    ],
    [
      {
        icon: 'list',
        label: () => m.rich_text_bullet_list(),
        active: (e) => e.isActive('bulletList'),
        run: (e) => e.chain().focus().toggleBulletList().run(),
      },
      {
        icon: 'list-ordered',
        label: () => m.rich_text_ordered_list(),
        active: (e) => e.isActive('orderedList'),
        run: (e) => e.chain().focus().toggleOrderedList().run(),
      },
      {
        icon: 'quote',
        label: () => m.rich_text_quote(),
        active: (e) => e.isActive('blockquote'),
        run: (e) => e.chain().focus().toggleBlockquote().run(),
      },
      {
        icon: 'code',
        label: () => m.rich_text_code(),
        active: (e) => e.isActive('code') || e.isActive('codeBlock'),
        // Some text inside one block is code in a line; an empty cursor or several blocks, a code block.
        run: (e) => {
          const { empty, $from: start, $to: end } = e.state.selection;
          if (!empty && start.sameParent(end)) e.chain().focus().toggleCode().run();
          else e.chain().focus().toggleCodeBlock().run();
        },
      },
      {
        icon: 'minus',
        label: () => m.rich_text_rule(),
        run: (e) => e.chain().focus().setHorizontalRule().run(),
      },
    ],
    [
      {
        icon: 'link',
        label: () => m.rich_text_link(),
        active: (e) => e.isActive('link'),
        run: (e) => openLink(e),
      },
    ],
    [
      {
        icon: 'undo-2',
        label: () => m.rich_text_undo(),
        run: (e) => e.chain().focus().undo().run(),
        disabled: (e) => !e.can().undo(),
      },
      {
        icon: 'redo-2',
        label: () => m.rich_text_redo(),
        run: (e) => e.chain().focus().redo().run(),
        disabled: (e) => !e.can().redo(),
      },
    ],
  ];

  function openLink(e: Editor) {
    linkUrl = (e.getAttributes('link').href as string | undefined) ?? '';
    linkInvalid = false;
    linkOpen = true;
    queueMicrotask(() => linkInput?.focus());
  }

  function applyLink() {
    if (!editor) return;
    const raw = linkUrl.trim();
    if (!raw) return removeLink();
    // A bare address ("exemplo.com") or e-mail is completed, as people type them.
    const href = /^[a-z][a-z0-9+.-]*:/i.test(raw)
      ? raw
      : raw.includes('@') && !raw.includes('/')
        ? `mailto:${raw}`
        : `https://${raw}`;
    if (!/^(https?:\/\/|mailto:)\S+$/i.test(href)) {
      linkInvalid = true;
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    linkOpen = false;
  }

  function removeLink() {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    linkOpen = false;
  }

  function closeLink() {
    linkOpen = false;
    editor?.commands.focus();
  }

  // Arrow keys move along the toolbar and Tab leaves it: one stop in the page's tab order.
  function toolbarKeys(event: KeyboardEvent) {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key) || !toolbar) return;
    const buttons = [...toolbar.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (at + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    for (const button of buttons) button.tabIndex = -1;
    buttons[next].tabIndex = 0;
    buttons[next].focus();
  }

  onMount(() => {
    void (async () => {
      // Loaded on demand: the editor is a sizeable chunk and most pages never show one.
      const [{ Editor }, { StarterKit }] = await Promise.all([
        import('@tiptap/core'),
        import('@tiptap/starter-kit'),
      ]);
      if (stop || !host) return;
      const instance = new Editor({
        element: host,
        // The stylesheet is imported (rich-text.css); the CSP does not allow the style tag Tiptap would add.
        injectCSS: false,
        content: cleanRichHtml(html),
        extensions: [
          StarterKit.configure({
            heading: { levels: [2, 3] },
            link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
            dropcursor: false,
            gapcursor: false,
          }),
        ],
        editorProps: {
          attributes: {
            id,
            role: 'textbox',
            'aria-multiline': 'true',
            'aria-labelledby': `${id}-label`,
            class: `rich-text ${MIN_HEIGHT[rows]} p-3 outline-none`,
          },
        },
        onTransaction: () => {
          tick += 1;
        },
        onUpdate: ({ editor: updated }) => {
          emitted = updated.isEmpty ? '' : updated.getHTML();
          value = emitted;
        },
      });
      editor = instance;
      ready = true;
    })();
    return () => {
      stop = true;
      editor?.destroy();
    };
  });

  // A change from outside (a draft restored, the form reset) goes into the editor.
  $effect(() => {
    const next = html;
    if (!editor || next === emitted) return;
    emitted = next;
    editor.commands.setContent(cleanRichHtml(next), { emitUpdate: false });
  });

  $effect(() => {
    const dom = editor?.view.dom;
    if (!dom) return;
    if (invalid || over) dom.setAttribute('aria-invalid', 'true');
    else dom.removeAttribute('aria-invalid');
    if (describedby) dom.setAttribute('aria-describedby', describedby);
    else dom.removeAttribute('aria-describedby');
  });
</script>

<!-- Until the editor is ready (and without JavaScript) a plain textarea stands in: it is what a native
     POST submits, and the server makes paragraphs of it. Once the editor is ready the textarea is gone,
     so the label has one control, and a hidden input keeps the field's `name` with the HTML. -->
{#if ready}
  <input type="hidden" {name} value={html} />
{:else}
  <textarea
    {id}
    {name}
    {rows}
    value={toPlainText(html)}
    oninput={(event) => (value = event.currentTarget.value)}
    class="textarea w-full rounded-lg border-surface-200-800 bg-panel p-3"
    aria-invalid={invalid ? 'true' : undefined}
    aria-describedby={describedby}></textarea>
{/if}

<!-- Always in the page, so the editor has an element to mount in; shown once it is ready. -->
<div
  hidden={!ready}
  class="rounded-lg border border-surface-200-800 bg-panel focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-500 {invalid ||
  over
    ? 'border-error-500'
    : ''}"
>
  <div
    bind:this={toolbar}
    role="toolbar"
    tabindex="-1"
    aria-label={m.rich_text_toolbar()}
    onkeydown={toolbarKeys}
    class="flex flex-wrap items-center gap-1 border-b border-surface-200-800 p-1"
  >
    {#each TOOLS as group, groupIndex (groupIndex)}
      {#if groupIndex > 0}
        <span class="mx-1 h-5 w-px bg-surface-200-800" aria-hidden="true"></span>
      {/if}
      {#each group as tool (tool.icon)}
        {@const pressed = pressedOf(tool)}
        {@const disabled = disabledOf(tool)}
        <button
          type="button"
          title={tool.label()}
          aria-label={tool.label()}
          aria-pressed={tool.active ? pressed : undefined}
          {disabled}
          tabindex={groupIndex === 0 && tool.icon === 'bold' ? 0 : -1}
          onmousedown={(event) => event.preventDefault()}
          onclick={() => editor && tool.run(editor)}
          class="btn-icon size-9 rounded-md hover:preset-tonal disabled:opacity-40 {pressed
            ? 'preset-tonal-primary'
            : ''}"
        >
          <Icon name={tool.icon} size={18} />
        </button>
      {/each}
    {/each}
  </div>

  {#if linkOpen}
    <div class="flex flex-wrap items-center gap-2 border-b border-surface-200-800 p-2">
      <label class="sr-only" for="{id}-link">{m.rich_text_link_url()}</label>
      <input
        id="{id}-link"
        bind:this={linkInput}
        bind:value={linkUrl}
        type="text"
        inputmode="url"
        autocomplete="off"
        placeholder="https://"
        aria-invalid={linkInvalid ? 'true' : undefined}
        aria-describedby={linkInvalid ? `${id}-link-error` : undefined}
        onkeydown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            applyLink();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            closeLink();
          }
        }}
        class="input h-9 min-w-0 flex-1 rounded-lg border-surface-200-800 px-3"
      />
      <button type="button" class="btn preset-filled-primary-500 btn-sm" onclick={applyLink}
        >{m.rich_text_link_apply()}</button
      >
      {#if editor?.isActive('link')}
        <button type="button" class="btn btn-sm hover:preset-tonal" onclick={removeLink}
          >{m.rich_text_link_remove()}</button
        >
      {/if}
      <button type="button" class="btn btn-sm hover:preset-tonal" onclick={closeLink}
        >{m.rich_text_link_cancel()}</button
      >
      {#if linkInvalid}
        <p
          id="{id}-link-error"
          role="alert"
          class="w-full text-sm font-semibold text-error-700-300"
        >
          {m.rich_text_link_invalid()}
        </p>
      {/if}
    </div>
  {/if}

  <div bind:this={host}></div>
</div>
<p
  hidden={!ready}
  class="mt-1 text-right text-sm {over ? 'font-semibold text-error-700-300' : 'text-muted'}"
>
  {m.rich_text_count({ count: richTextLength(html), max: maxlength })}
</p>

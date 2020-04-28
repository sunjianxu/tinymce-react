/**
 * Copyright (c) 2017-present, Ephox, Inc.
 *
 * This source code is licensed under the Apache 2 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import { EventHandler, IEvents } from '../Events';
import { ScriptLoader } from '../ScriptLoader';
import { getTinymce, TinymceConfig, TinymceEditor, TinymceBookmark } from '../TinyMCE';
import { bindHandlers, isFunction, isTextarea, mergePlugins, uuid } from '../Utils';
import { EditorPropTypes, IEditorPropTypes } from './EditorPropTypes';

export interface IProps {
  apiKey: string;
  id: string;
  inline: boolean;
  initialValue: string;
  onEditorChange: EventHandler<any>;
  value: string;
  init: Record<string, any>;
  outputFormat: 'html' | 'text';
  tagName: string;
  cloudChannel: string;
  plugins: string | string[];
  toolbar: string | string[];
  disabled: boolean;
  textareaName: string;
  tinymceScriptSrc: string;
}

export interface IAllProps extends Partial<IProps>, Partial<IEvents> {}

export class Editor extends React.Component<IAllProps> {
  public static propTypes: IEditorPropTypes = EditorPropTypes;

  public static defaultProps: Partial<IAllProps> = {
    cloudChannel: '5'
  };

  private id: string;
  private elementRef: React.RefObject<Element>;
  private editor: TinymceEditor | null;
  private inline: boolean;
  private currentContent?: string | null;
  private boundHandlers: Record<string, EventHandler<any>>;

  constructor (props: Partial<IAllProps>) {
    super(props);
    this.id = this.props.id || uuid('tiny-react');
    this.elementRef = React.createRef<Element>();
    this.inline = this.props.inline ? this.props.inline : this.props.init && this.props.init.inline;
    this.boundHandlers = {};
    this.editor = null;
  }

  public componentDidUpdate (prevProps: Partial<IAllProps>) {
    if (this.editor && this.editor.initialized) {
      bindHandlers(this.editor, this.props, this.boundHandlers);

      this.currentContent = this.currentContent || this.editor.getContent({ format: this.props.outputFormat });

      if (typeof this.props.value === 'string' && this.props.value !== this.currentContent) {
        console.log('setContent');
        this.editor.setContent(this.props.value);
      }
      if (typeof this.props.disabled === 'boolean' && this.props.disabled !== prevProps.disabled) {
        this.editor.setMode(this.props.disabled ? 'readonly' : 'design');
      }
    }
  }

  public componentDidMount() {
    if (getTinymce() !== null) {
      this.initialise();
    } else if (this.elementRef.current && this.elementRef.current.ownerDocument) {
      ScriptLoader.load(
        this.elementRef.current.ownerDocument,
        this.getScriptSrc(),
        this.initialise
      );
    }
  }

  public componentWillUnmount() {
    if (this.editor !== null) {
      getTinymce()?.remove(this.editor);
    }
  }

  public render() {
    return this.inline ? this.renderInline() : this.renderIframe();
  }

  private getScriptSrc() {
    const channel = this.props.cloudChannel;
    const apiKey = this.props.apiKey ? this.props.apiKey : 'no-api-key';

    return (this.props.tinymceScriptSrc === undefined || this.props.tinymceScriptSrc === null) ?
      `https://cdn.tiny.cloud/1/${apiKey}/tinymce/${channel}/tinymce.min.js` :
      this.props.tinymceScriptSrc;
  }
  private initialise = () => {
    const finalInit: TinymceConfig = {
      ...this.props.init,
      target: this.elementRef.current,
      readonly: this.props.disabled,
      inline: this.inline,
      plugins: mergePlugins(this.props.init && this.props.init.plugins, this.props.plugins),
      toolbar: this.props.toolbar || (this.props.init && this.props.init.toolbar),
      setup: (editor) => {
        this.editor = editor;
        editor.on('Init', (evt) => {
          this.initEditor(evt, editor);
        });

        if (this.props.init && typeof this.props.init.setup === 'function') {
          this.props.init.setup(editor);
        }
      }
    };

    if (isTextarea(this.elementRef.current)) {
      this.elementRef.current.style.visibility = '';
    }

    getTinymce()?.init(finalInit);
  }

  private initEditor(initEvent: unknown, editor: TinymceEditor) {
    const value =
      typeof this.props.value === 'string' ? this.props.value : typeof this.props.initialValue === 'string' ? this.props.initialValue : '';
    editor.setContent(value);

    if (isFunction(this.props.onEditorChange)) {
      editor.on('change keyup setcontent', (_evt) => {
        const newContent = editor.getContent({ format: this.props.outputFormat });

        if (newContent !== this.currentContent) {
          this.currentContent = newContent;
          if (isFunction(this.props.onEditorChange)) {
            this.props.onEditorChange(this.currentContent, editor);
          }
        }
      });
    }

    if (isFunction(this.props.onInit)) {
      this.props.onInit(initEvent, editor);
    }

    bindHandlers(editor, this.props, this.boundHandlers);
  }

  private renderInline() {
    const { tagName = 'div' } = this.props;

    return React.createElement(tagName, {
      ref: this.elementRef,
      id: this.id
    });
  }

  private renderIframe() {
    return React.createElement('textarea', {
      ref: this.elementRef,
      style: { visibility: 'hidden' },
      name: this.props.textareaName,
      id: this.id
    });
  }
}
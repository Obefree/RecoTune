import React, { forwardRef, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import { SNIPPET_ANALYZER_HTML } from '../recognition/snippetAnalyzerHtml';
import {
  handleSnippetAnalyzerMessage,
  registerSnippetAnalyzerEngine,
  setSnippetAnalyzerReady,
} from '../recognition/snippetAnalyzerBridge';

/** Hidden WebView for НАЙТИ snippet BPM/chroma (no fake match without signal). */
const SnippetAnalyzerEngine = forwardRef<WebView>(function SnippetAnalyzerEngine(_, ref) {
  const onMessage = useCallback((e: WebViewMessageEvent) => {
    handleSnippetAnalyzerMessage(e.nativeEvent.data);
  }, []);

  return (
    <WebView
      ref={node => {
        registerSnippetAnalyzerEngine(node);
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      source={{ html: SNIPPET_ANALYZER_HTML, baseUrl: 'https://localhost' }}
      style={styles.hidden}
      onMessage={onMessage}
      javaScriptEnabled
      originWhitelist={['*']}
      pointerEvents="none"
      collapsable={false}
      onLoadEnd={() => setSnippetAnalyzerReady(true)}
      onError={() => setSnippetAnalyzerReady(false)}
    />
  );
});

export default SnippetAnalyzerEngine;

/** Как ChordsScreen hiddenWV — не участвует во flex, иначе Android режет экран пополам */
const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    left: -9999,
    top: 0,
    width: 1,
    height: 1,
    opacity: 0,
    zIndex: -1,
  },
});

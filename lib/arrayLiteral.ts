/**
 * Postgres の配列リテラル文字列 (e.g., "{\"url1\",\"url2\"}") を
 * JavaScript の文字列配列 (e.g., ["url1", "url2"]) に変換します。
 *
 * @param value 変換対象の値。文字列、文字列配列、またはその他の型。
 * @returns 変換後の文字列配列。変換できない場合は空配列。
 */
export const pgTextArrayToJs = (value: unknown): string[] => {
    // 既に配列ならそのまま返す (Typescript/Supabase が正しく解釈した場合)
    if (Array.isArray(value)) {
      // 配列要素が文字列であることを確認 (より厳密なチェック)
      if (value.every(item => typeof item === 'string')) {
        return value as string[];
      }
      // 文字列配列でなければ空配列を返す
      return [];
    }
  
    // 文字列でなければ処理できない
    if (typeof value !== "string") {
      return [];
    }
  
    // 空文字列や '{}' のような空の配列リテラルは空配列として扱う
    const trimmedValue = value.trim();
    if (trimmedValue === "" || trimmedValue === "{}") {
      return [];
    }
  
    // Postgres 配列リテラルの形式でない場合は空配列を返す
    // (厳密ではないが、最低限 { } で囲まれているかチェック)
    if (!trimmedValue.startsWith("{") || !trimmedValue.endsWith("}")) {
      console.warn("pgTextArrayToJs: Input string is not a valid PostgreSQL array literal:", value);
      return [];
    }
  
    try {
      return (
        trimmedValue
          // 1. 外側の { } を除去
          .substring(1, trimmedValue.length - 1)
          // 2. カンマで分割 (ただし、引用符内のカンマは無視する必要があるが、単純 split で対応)
          //    注意: URL にカンマが含まれるケースは稀だが、完全に安全ではない
          .split(",")
          // 3. 各要素の前後の空白を除去し、引用符があれば除去
          .map((item) => {
            const trimmedItem = item.trim();
            // ダブルクォートで囲まれている場合
            if (trimmedItem.startsWith('"') && trimmedItem.endsWith('"')) {
              // 前後のダブルクォートを除去し、エスケープされたダブルクォート ("") を元に戻す (")
              return trimmedItem.substring(1, trimmedItem.length - 1).replace(/""/g, '"');
            }
            // シングルクォートで囲まれている場合 (通常はないが念のため)
            if (trimmedItem.startsWith("'") && trimmedItem.endsWith("'")) {
              // 前後のシングルクォートを除去し、エスケープされたシングルクォート ('') を元に戻す (')
              return trimmedItem.substring(1, trimmedItem.length - 1).replace(/''/g, "'");
            }
            // NULL 値 (引用符なしの NULL) は空文字列として扱うか、フィルタリングするか選択
            if (trimmedItem.toUpperCase() === 'NULL') {
              return null; // null として一旦保持し、後でフィルタリング
            }
            // 引用符なしの場合
            return trimmedItem;
          })
          // 4. map の結果から null を除外し、string 型のみにする
          .filter((item): item is string => item !== null)
          // 5. 結果が空文字列だけの配列になるのを防ぐ (任意)
          .filter(item => item !== '')
      );
    } catch (error) {
      console.error("Error parsing PostgreSQL array literal:", value, error);
      return []; // パース中にエラーが発生した場合も空配列
    }
  };
  
  /**
   * JavaScript の文字列配列を Postgres の配列リテラル文字列に変換します。
   * @param arr 変換する文字列配列
   * @returns Postgres 配列リテラル文字列 (e.g., "{\"url1\",\"url2\"}") または null
   */
  export const jsArrayToPgLiteral = (arr: string[] | null | undefined): string | null => {
    if (!arr || arr.length === 0) {
      return null; // 空配列や null/undefined は DB に NULL として保存
    }
    // 各要素内のダブルクォートをエスケープ (") → ("") し、全体をダブルクォートで囲む
    const escapedElements = arr.map(item => `"${item.replace(/"/g, '""')}"`);
    return `{${escapedElements.join(",")}}`;
  };
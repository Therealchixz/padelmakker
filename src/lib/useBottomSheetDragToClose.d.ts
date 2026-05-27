import type { RefObject, HTMLAttributes, CSSProperties } from 'react'

export declare function useBottomSheetDragToClose(options?: {
  onClose?: () => void
  enabled?: boolean
}): {
  sheetRef: RefObject<HTMLDivElement>
  dragZoneProps: HTMLAttributes<HTMLDivElement>
  sheetStyle: CSSProperties
  sheetClassName: string
}

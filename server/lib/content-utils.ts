import {Node} from 'slate'

export const convertSlateToText =  (nodes: Node[]) => nodes.map(n => Node.string(n)).join('\n')
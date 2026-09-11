import { createBuilding, ImagePanel, ProductDisplay, TextPanel, type BuildingDefinition } from './Building.js'
import type { Node } from '@sekai64-internal/scene'

export interface BuildingObjectDefinition extends BuildingDefinition { type: 'building'; position?: readonly [number, number, number] }
export interface TextPanelDefinition { type: 'text-panel'; id?: string; text: string; width?: number; height?: number; color?: string }
export interface ImagePanelDefinition { type: 'image-panel'; id?: string; source: string; width?: number; height?: number; color?: string }
export interface ProductDisplayDefinition { type: 'product-display'; id?: string; productId: string; width?: number; height?: number; depth?: number; color?: string; metadata?: Readonly<Record<string, unknown>> }
export type BuildingSceneObjectDefinition = BuildingObjectDefinition | TextPanelDefinition | ImagePanelDefinition | ProductDisplayDefinition

export function createBuildingObject(definition: BuildingSceneObjectDefinition, path = 'object'): Node {
  if (definition.type === 'building') {
    const building = createBuilding(definition)
    if (definition.position) building.position.fromArray(definition.position)
    return building
  }
  if (definition.type === 'text-panel') {
    if (typeof definition.text !== 'string') throw new Error(`${path}.text must be a string.`)
    return new TextPanel(definition.text, definition)
  }
  if (definition.type === 'image-panel') {
    if (typeof definition.source !== 'string') throw new Error(`${path}.source must be a string.`)
    return new ImagePanel(definition.source, definition)
  }
  if (definition.type === 'product-display') {
    if (typeof definition.productId !== 'string') throw new Error(`${path}.productId must be a string.`)
    return new ProductDisplay(definition.productId, definition)
  }
  throw new Error(`${path}.type is not a supported building object.`)
}

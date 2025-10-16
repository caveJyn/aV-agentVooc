import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'

export default defineConfig({
  name: 'default',
  title: 'agentVooc',

  projectId: 'accpintx',
  dataset: 'production',

  plugins: [structureTool(), visionTool()],

  schema: {
      },
})
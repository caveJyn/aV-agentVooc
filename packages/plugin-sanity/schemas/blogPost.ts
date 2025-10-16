export default {
  name: "blogPost",
  title: "Blog Post",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Title",
      type: "string",
      description: "The title of the blog post (used as headline in structured data)",
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "title",
        maxLength: 96,
      },
      validation: (Rule: any) => Rule.required(),
    },
    {
  name: 'content',
  title: 'Content',
  type: 'array',
  of: [
    { type: 'block' },
    {
      type: 'image',
      fields: [
        {
          name: 'alt',
          title: 'Alt Text',
          type: 'string',
          description: 'Describe the image for accessibility and SEO',
          validation: (Rule: any) => Rule.required(),
        },
      ],
    },
    { type: 'table' },
  ],
  validation: (Rule: any) =>
    Rule.required().custom((content: any[]) => {
      const tableCount = content.filter((item: any) => item._type === 'table').length;
      return tableCount <= 5 ? true : 'A blog post can have a maximum of 5 tables for performance reasons.';
    }),
},
    {
      name: "publishedAt",
      title: "Published At",
      type: "datetime",
      description: "Publication date (used as datePublished in structured data)",
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "modifiedAt",
      title: "Modified At",
      type: "datetime",
      description: "Last modified date (used as dateModified in structured data)",
    },
    {
      name: "seoDescription",
      title: "SEO Description",
      type: "string",
      description: "Description for SEO meta tags and structured data (max 160 characters)",
      validation: (Rule: any) => Rule.required().max(300),
    },
    {
      name: "excerpt",
      title: "Excerpt",
      type: "string",
      description: "A short summary for frontend previews, e.g., in blog lists (max 200 characters)",
      validation: (Rule: any) => Rule.required().max(300),
    },
    {
      name: "mainImage",
      title: "Main Image",
      type: "image",
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: "alt",
          title: "Alt Text",
          type: "string",
          description: "Describe the image for accessibility and SEO (used as image description in structured data)",
          validation: (Rule: any) => Rule.required(),
        },
      ],
      description: "Featured image for social media, previews, and structured data",
    },
    {
      name: "heroImage",
      title: "Hero Image",
      type: "image",
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: "alt",
          title: "Alt Text",
          type: "string",
          description: "Describe the hero image for accessibility and SEO",
          validation: (Rule: any) => Rule.required(),
        },
      ],
      description: "Prominent image displayed at the top of the blog post",
    },
    {
      name: "galleryImages",
      title: "Gallery Images",
      type: "array",
      of: [
        {
          type: "image",
          fields: [
            {
              name: "alt",
              title: "Alt Text",
              type: "string",
              description: "Describe the gallery image for accessibility and SEO",
              validation: (Rule: any) => Rule.required(),
            },
          ],
          options: {
            hotspot: true,
          },
        },
      ],
      description: "Additional images to display in a gallery section",
    },
    {
      name: "tags",
      title: "Tags",
      type: "array",
      of: [{ type: "string" }],
      description: "Keywords for SEO and structured data",
    },
    {
      name: "relatedContent",
      title: "Related Content",
      type: "array",
      of: [
        {
          type: "reference",
          to: [
            { type: "blogPost" },
            { type: "pressPost" },
            { type: "productPage" },
          ],
        },
      ],
      description: "Select up to 3 related blog posts, press posts, or product posts to display at the bottom of the blog post",
      validation: (Rule: any) => Rule.max(3), // Limit to 3 related posts
    },

    {
      name: 'adSlotHeader',
      title: 'AdSense Slot ID (Header)',
      type: 'string',
      description: 'Google AdSense ad slot ID for the ad displayed after the hero/main image on the blog post page (e.g., 1234567890)',
      validation: (Rule: any) =>
        Rule.optional().regex(/^\d{10}$/, {
          name: 'adSlot',
          invert: false,
        }),
    },
    {
      name: 'adSlotContent',
      title: 'AdSense Slot ID (Content)',
      type: 'string',
      description: 'Google AdSense ad slot ID for the ad displayed before related content on the blog post page (e.g., 9876543210)',
      validation: (Rule: any) =>
        Rule.optional().regex(/^\d{10}$/, {
          name: 'adSlot',
          invert: false,
        }),
    },
    {
      name: 'adSlotRightSide',
      title: 'AdSense Slot ID (Sidebar)',
      type: 'string',
      description: 'Google AdSense ad slot ID for the ad displayed in the sidebar on the blog post page (e.g., 5555555555)',
      validation: (Rule: any) =>
        Rule.optional().regex(/^\d{10}$/, {
          name: 'adSlot',
          invert: false,
        }),
    },
    {
      name: 'adSlotIndex',
      title: 'AdSense Slot ID (Blog Index)',
      type: 'string',
      description: 'Google AdSense ad slot ID for the ad displayed above the blog grid on the blog index page (e.g., 4444444444)',
      validation: (Rule: any) =>
        Rule.optional().regex(/^\d{10}$/, {
          name: 'adSlot',
          invert: false,
        }),
    },
    {
      name: "published",
      title: "Published",
      type: "boolean",
      initialValue: false,
    },
  ],
};
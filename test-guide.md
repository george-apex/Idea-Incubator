# Testing Guide for Idea Incubator

## How to Import Meeting Notes

1. Open the Idea Incubator application
2. Click "Import Meeting Notes" in the sidebar
3. Copy the content from `test-meeting-notes.md`
4. Paste into the import dialog
5. Click "Import"

## Expected Results

### Number of Ideas Generated
The meeting notes should generate **15-20 ideas** covering:

1. **AI-Powered Smart Suggestions** - Auto-tagging and categorization
2. **Advanced Analytics Dashboard** - Real-time analytics
3. **Mobile-First Redesign** - Native iOS/Android apps
4. **Workflow Automation** - No-code workflow builder
5. **Enhanced Search with Vector Embeddings** - Semantic search
6. **Real-Time Collaboration** - Live cursors and presence
7. **Custom Branding for Enterprise** - White-label solution
8. **Offline Mode with Sync** - PWA with local storage
9. **Advanced Permissions System** - RBAC implementation
10. **Integration Marketplace** - App store for integrations
11. **Dark Mode Implementation** - UI theme option
12. **Keyboard Shortcuts** - Productivity enhancement
13. **Bulk Operations** - Mass edit/delete
14. **Custom Templates** - User-defined templates
15. **Advanced Search Filters** - Enhanced search
16. **Data Export Features** - CSV/Excel export
17. **Notification Preferences** - Granular controls
18. **Onboarding Optimization** - Reduce drop-off
19. **Mobile Performance Fixes** - Crash resolution
20. **API Rate Limiting** - Enterprise scaling

## Features to Test

### 1. AI Enhancements
- **Auto-tagging**: Check if ideas have relevant tags based on content
- **Category suggestions**: Verify categories match the content
- **Related ideas**: Check if similar ideas are linked
- **Confidence scores**: Review AI confidence in suggestions

### 2. Tag Suggestions
- Click on an idea to view details
- Type in the tag input field (2+ characters)
- Verify suggestions appear in 4 categories:
  - **From Content**: Extracted from idea text
  - **Related Tags**: Based on co-occurrence
  - **From Connected Ideas**: Tags from linked ideas
  - **Similar Tags**: Alternative spellings/variants
- Click a suggestion to add it
- Press Enter to add custom tags
- Press Backspace to remove last tag
- Click × on chip to remove specific tag

### 3. Idea Canvas
- Open an idea and switch to "Canvas" view
- Verify all sections are populated:
  - Problem
  - Solution
  - Assumptions
  - Open Questions
  - Next Steps
- Add/edit items in each section
- Check confidence slider functionality

### 4. Idea Merging
- Select 2-3 related ideas (e.g., mobile app features)
- Click "Merge Selected Ideas"
- Verify merged idea contains combined content
- Check that original ideas are archived
- Test "Split" functionality to restore originals

### 5. Search & Filter
- Use search bar to find ideas by:
  - Title
  - Tags
  - Content
- Filter by status (Backlog, Exploring, Validating, Building, Launched)
- Filter by category
- Sort by confidence, date, or title

### 6. Status Management
- Change idea status through dropdown
- Verify status color coding
- Track status changes in review history

### 7. Confidence Scoring
- Adjust confidence slider (0-100%)
- Verify visual feedback
- Check if confidence affects sorting

### 8. Color Variants
- Change color variant for ideas
- Verify visual distinction
- Use colors to group related ideas

### 9. Links & Connections
- Link related ideas together
- Verify bidirectional links
- Check "From Connected Ideas" tag suggestions

### 10. Review History
- Make changes to an idea
- Check review history for audit trail
- Verify timestamps and change descriptions

## Testing Checklist

### Import & Generation
- [ ] Meeting notes import successfully
- [ ] 15-20 ideas are generated
- [ ] Ideas have meaningful titles
- [ ] Content is properly categorized
- [ ] Tags are relevant

### AI Features
- [ ] Auto-tagging works accurately
- [ ] Categories are appropriate
- [ ] Related ideas are linked
- [ ] Confidence scores are reasonable

### Tag Suggestions
- [ ] Suggestions appear when typing
- [ ] All 4 categories show relevant tags
- [ ] Clicking suggestions adds tags
- [ ] Custom tags can be added
- [ ] Tags can be removed
- [ ] Tag vocabulary updates

### UI/UX
- [ ] Dark mode toggle works
- [ ] Responsive design on different screen sizes
- [ ] Keyboard shortcuts function
- [ ] Loading states are smooth
- [ ] Error messages are clear

### Data Management
- [ ] Ideas can be created manually
- [ ] Ideas can be edited
- [ ] Ideas can be deleted
- [ ] Ideas can be archived
- [ ] Ideas can be merged
- [ ] Ideas can be split

### Performance
- [ ] Page loads quickly
- [ ] Search is responsive
- [ ] Tag suggestions appear promptly
- [ ] No lag when switching views

## Common Issues to Watch For

1. **Duplicate ideas**: Check if similar ideas are merged
2. **Missing content**: Verify all sections are populated
3. **Irrelevant tags**: AI should suggest meaningful tags
4. **Broken links**: Ensure idea connections work
5. **Slow performance**: Large datasets should load quickly
6. **UI glitches**: Check for layout issues on different browsers

## Browser Compatibility
Test on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Mobile Testing
Test on:
- iPhone (iOS 15+)
- Android (Android 10+)
- Tablet (iPad/Android tablet)

## Feedback Notes

Document any issues found:
- Feature not working as expected
- UI/UX improvements needed
- Performance concerns
- Bugs or errors
- Enhancement suggestions

---

**Happy Testing!** 🚀

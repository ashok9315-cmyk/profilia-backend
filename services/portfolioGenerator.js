const Anthropic = require("@anthropic-ai/sdk");

/**
 * Generate a stunning HTML portfolio page from resume text using Claude
 * @param {string} resumeText - The extracted resume text
 * @returns {Promise<string>} - Generated HTML portfolio
 */
async function generatePortfolio(resumeText) {
    try {
        // Initialize Anthropic client
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });

        const prompt = `You are a HTML code generator. You MUST respond ONLY with HTML code. NO questions. NO explanations.

Create a stunning, complete HTML portfolio website from the resume data below.

MANDATORY STRUCTURE:
1. Fixed navigation bar (position: fixed, backdrop-filter: blur(10px))
2. Hero section (min-height: 100vh) with large gradient name (4rem), title, summary, 2 CTA buttons
3. About section with 2-column grid: professional summary + stats grid (2x2 cards with achievement numbers)
4. Skills section with category cards (emoji + title + skill tags in pills)
5. Experience section with vertical timeline (gradient line, glowing dots, hoverable cards)
6. Projects section with 3-column grid (if projects exist in resume)
7. Education section with cards
8. Contact section with social links (email, LinkedIn, GitHub, website)

MANDATORY CSS FEATURES:
- CSS variables: --primary: #00d4ff; --secondary: #7c3aed; --accent: #f59e0b; --dark: #0a0e27
- Hero h1: font-size 4rem, gradient text (primary->secondary->accent), animation fadeInUp
- fadeInUp animation: @keyframes with opacity 0->1, translateY(30px)->0
- Stat cards: background rgba(0,212,255,0.05), border-radius 15px, hover translateY(-5px)
- Stat numbers: font-size 2.5rem, color primary, bold
- Skill tags: border-radius 25px, hover scale(1.05) and background change
- Timeline vertical line: width 2px, gradient primary->secondary, ::before pseudo-element
- Timeline dots: 15px circle, glowing box-shadow: 0 0 0 3px rgba(0,212,255,0.3)
- Timeline items: hover translateX(10px)
- Custom scrollbar with gradient thumb
- Responsive: @media (max-width: 768px) with 1-column grids
- All transitions: transition: all 0.3s

EXTRACT ALL INFORMATION:
- Parse name, title, summary, ALL skills, ALL experiences (company, role, dates, achievements), education, projects, contact info
- Use actual data from resume, organize skills by category (AI/ML, Cloud, DevOps, Programming, etc.)
- Include emoji icons for skill categories (🤖, ☁️, 💻, 📊, etc.)
- Make stats based on years of experience, achievements mentioned in resume

Resume Data:
${resumeText}

Your response MUST be ONLY valid HTML code starting with <!DOCTYPE html>. Begin now:`;

        // Generate portfolio
        console.log('Generating portfolio with AI...');
        const message = await anthropic.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 16384,
            top_p: 0.7,
            messages: [{
                role: "user",
                content: prompt
            }]
        });

        // Extract HTML content from response
        let cleanHTML = message.content[0].text.trim();
        
        // Remove markdown code blocks if present
        if (cleanHTML.startsWith('```html')) {
            cleanHTML = cleanHTML.replace(/```html\n/, '').replace(/\n```$/, '');
        } else if (cleanHTML.startsWith('```')) {
            cleanHTML = cleanHTML.replace(/```\n/, '').replace(/\n```$/, '');
        }
        
        // Find the start of actual HTML (<!DOCTYPE html>)
        const htmlStartIndex = cleanHTML.indexOf('<!DOCTYPE html>');
        if (htmlStartIndex > 0) {
            cleanHTML = cleanHTML.substring(htmlStartIndex);
            console.log('Removed conversational prefix before HTML');
        } else if (htmlStartIndex === -1) {
            const htmlTagIndex = cleanHTML.indexOf('<html');
            if (htmlTagIndex > 0) {
                cleanHTML = cleanHTML.substring(htmlTagIndex);
                console.log('Removed conversational prefix before <html> tag');
            }
        }
        
        // Validate we have HTML
        if (!cleanHTML.includes('<html')) {
            throw new Error('Generated content does not appear to be valid HTML');
        }

        console.log('Portfolio HTML generated successfully');
        return cleanHTML;

    } catch (error) {
        console.error('Error generating portfolio:', error);
        throw new Error(`Portfolio generation failed: ${error.message}`);
    }
}

/**
 * Alternative implementation using LangGraph for more complex workflows
 */
async function generatePortfolioWithLangGraph(resumeText) {
    return await generatePortfolio(resumeText);
}

module.exports = {
    generatePortfolio,
    generatePortfolioWithLangGraph
};

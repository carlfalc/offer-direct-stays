/**
 * The four agreements an owner accepts before claiming a business, split so the
 * policy name can be a clickable link that opens the full text in a popup.
 * Plain, platform-appropriate wording for a NZ/AU make-an-offer booking
 * platform — refine the legal copy any time without touching the UI.
 */
export interface Agreement {
  id: 'terms' | 'liability' | 'security' | 'declaration';
  pre: string;        // text before the clickable policy name
  link: string;       // the clickable, underlined policy name
  post: string;       // text after the link
  title: string;      // popup heading
  body: string[];     // popup paragraphs
}

export const AGREEMENTS: Agreement[] = [
  {
    id: 'terms',
    pre: 'I have read and accept the findastay ',
    link: 'Terms & Conditions',
    post: '.',
    title: 'findastay Terms & Conditions',
    body: [
      'findastay is a marketplace that connects travellers with accommodation providers in New Zealand and Australia. Travellers make an offer for a stay; you choose to accept, counter or decline. findastay does not set your prices and takes no commission on the booking.',
      'When an offer is confirmed, the traveller pays a one-off commitment fee to findastay. The balance for the stay is paid directly to you, the provider, by the method and timing you set. findastay never collects or holds the accommodation payment.',
      'You are responsible for keeping your rooms, availability, prices and property details accurate and up to date, and for honouring any offer you accept at the agreed price and dates.',
      'findastay may update these terms from time to time. Continued use of the platform after a change means you accept the updated terms. These terms are governed by the laws of New Zealand.',
    ],
  },
  {
    id: 'liability',
    pre: 'I accept the ',
    link: 'Liability terms',
    post: ' — findastay is a booking platform; the stay contract is between me and the guest.',
    title: 'Liability terms',
    body: [
      'findastay provides the platform that introduces travellers and providers and processes the commitment fee. The contract for the stay itself is formed directly between you and the guest once an offer is confirmed.',
      'You are responsible for the accommodation and services you provide, for any damage, injury or dispute arising from a stay, and for complying with all laws that apply to your business, including health and safety, accommodation, consumer and tax obligations.',
      'findastay is not a party to the stay contract and is not liable for the conduct of guests or providers, for no-shows or cancellations, or for any loss arising from a stay. Our total liability to you is limited to the commitment fees we have received in connection with the affected booking.',
      'Nothing in these terms limits rights that cannot be excluded under the Consumer Guarantees Act 1993 or the Australian Consumer Law where they apply.',
    ],
  },
  {
    id: 'security',
    pre: 'I agree to the ',
    link: 'Security & data-handling policy',
    post: ' and will keep guest details safe.',
    title: 'Security & data-handling policy',
    body: [
      'When a booking is confirmed, findastay shares the guest’s contact details with you so you can complete the booking. You must use those details only to manage and deliver that stay.',
      'You agree to keep guest information secure, not to share or sell it, and to handle it in line with the Privacy Act 2020 (NZ) or the Privacy Act 1988 (AU) as applicable. Do not retain guest payment-card details beyond what is needed to take the agreed payment.',
      'Keep your findastay login credentials confidential and let us know promptly if you believe your account has been accessed without authorisation.',
      'findastay handles your own account and business data in line with its Privacy Policy.',
    ],
  },
  {
    id: 'declaration',
    pre: 'I declare ',
    link: 'this is my business',
    post: ' and I am authorised to list and manage it.',
    title: 'Ownership & authority declaration',
    body: [
      'By claiming this property you confirm that you are the owner or operator, or are otherwise authorised to list and manage it on findastay on the owner’s behalf.',
      'You confirm that the information you provide about the business is true and that you have the authority to accept bookings, set prices and enter into stay contracts for this property.',
      'Claiming a property you are not authorised to manage may result in the listing being removed and your account suspended. findastay may ask you to verify ownership or authority at any time.',
    ],
  },
];

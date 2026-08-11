export const LEGAL_LAST_UPDATED = Object.freeze({
  iso: '2026-08-11',
  label: '11 de agosto de 2026',
});

export const SITE_CONTACT_EMAIL = 'fotografiaarnaut@gmail.com';

// Os textos legais devem ser revistos antes da publicação definitiva.
export const LEGAL_PAGES = Object.freeze({
  terms: {
    title: 'Termos de Utilização',
    description: 'Consulte os Termos de Utilização do site Fotografia Arnaut.',
    intro:
      'Estes Termos de Utilização regulam o acesso e utilização do site Fotografia Arnaut e dos serviços disponibilizados através do mesmo.',
    closing:
      'Ao utilizar este site, o utilizador compromete-se a fazê-lo de forma lícita, responsável e respeitadora dos direitos da Fotografia Arnaut e de terceiros.',
    sections: [
      {
        title: 'Sobre o site',
        html: `
          <p>O site Fotografia Arnaut apresenta o trabalho de Beatriz Arnaut, permite conhecer os serviços disponíveis e disponibiliza o acesso a galerias privadas através de mecanismos próprios.</p>
          <p>Quando essa opção está ativa numa galeria, o site pode também permitir a seleção, compra e posterior download de fotografias.</p>
        `,
      },
      {
        title: 'Utilização do site',
        html: `
          <p>O utilizador deve utilizar o site de forma lícita e responsável. Não é permitido:</p>
          <ul>
            <li>tentar aceder a áreas, contas ou galerias sem autorização;</li>
            <li>interferir com o funcionamento, disponibilidade ou segurança do site;</li>
            <li>contornar mecanismos de autenticação, acesso ou proteção;</li>
            <li>utilizar, copiar ou distribuir conteúdos sem autorização;</li>
            <li>divulgar publicamente códigos ou ligações de acesso privado.</li>
          </ul>
        `,
      },
      {
        title: 'Propriedade intelectual',
        html: `
          <p>As fotografias, o logótipo, os textos, os elementos gráficos, o design e os restantes conteúdos apresentados no site estão protegidos por direitos de autor e outros direitos de propriedade intelectual.</p>
          <p>A reprodução, cópia, distribuição, venda ou utilização comercial destes conteúdos depende de autorização prévia da Fotografia Arnaut ou do respetivo titular.</p>
        `,
      },
      {
        title: 'Galerias privadas',
        html: `
          <p>O acesso a galerias privadas é realizado através de código, ligação ou outro mecanismo reservado e destina-se apenas a pessoas autorizadas.</p>
          <ul>
            <li>Os códigos e ligações privadas não devem ser partilhados publicamente.</li>
            <li>Os downloads dependem das permissões definidas para cada galeria.</li>
            <li>O acesso pode expirar ou ser desativado.</li>
            <li>As sessões podem ser terminadas pela administradora quando necessário.</li>
          </ul>
        `,
      },
      {
        title: 'Compra de fotografias',
        html: `
          <p>A compra está disponível apenas nas galerias em que a venda de fotografias tenha sido ativada. O utilizador seleciona as fotografias, confirma as condições apresentadas e realiza o pagamento através do fornecedor de pagamentos indicado no checkout.</p>
          <p>Após a confirmação do pagamento, o acesso aos ficheiros é disponibilizado durante o prazo indicado na galeria ou na encomenda. O preço, a duração dos downloads e outras condições específicas são apresentados antes da compra.</p>
        `,
      },
      {
        title: 'Disponibilidade do serviço',
        html: `
          <p>O site pode ficar temporariamente indisponível devido a manutenção, atualizações, falhas técnicas ou alterações necessárias ao serviço. Sempre que possível, serão adotadas medidas razoáveis para reduzir o impacto dessas interrupções.</p>
        `,
      },
      {
        title: 'Limitação de responsabilidade',
        html: `
          <p>A Fotografia Arnaut procura manter a informação e os serviços disponíveis de forma correta e segura. Não pode, contudo, garantir a ausência total de interrupções ou falhas externas ao seu controlo.</p>
          <p>Nada nestes Termos exclui ou limita responsabilidades que não possam ser legalmente excluídas ou limitadas.</p>
        `,
      },
      {
        title: 'Alterações aos termos',
        html: `
          <p>Estes Termos podem ser atualizados para refletir alterações legais, técnicas ou dos serviços. A versão em vigor e a respetiva data de atualização permanecem disponíveis nesta página.</p>
        `,
      },
      {
        title: 'Contacto',
        html: `
          <p>Para questões relacionadas com estes Termos, contacte a Fotografia Arnaut através de <a href="mailto:${SITE_CONTACT_EMAIL}">${SITE_CONTACT_EMAIL}</a>.</p>
          <p>Consulte também a nossa <a href="/privacidade/">Política de Privacidade</a>.</p>
        `,
      },
    ],
  },
  privacy: {
    title: 'Política de Privacidade',
    description: 'Saiba como a Fotografia Arnaut trata e protege os seus dados pessoais.',
    intro:
      'A sua privacidade é importante. Esta Política explica de forma clara como os dados pessoais são tratados durante a utilização do site Fotografia Arnaut.',
    closing:
      'Os dados são tratados apenas na medida necessária para prestar os serviços, proteger as galerias e cumprir as obrigações aplicáveis.',
    sections: [
      {
        title: 'Quem somos',
        html: `
          <p>A Fotografia Arnaut é o projeto de fotografia de Beatriz Arnaut, com atividade em Pombal, Leiria.</p>
          <p>Para questões sobre privacidade, pode utilizar o contacto indicado no final desta Política.</p>
        `,
      },
      {
        title: 'Dados que recolhemos',
        html: `
          <p>Consoante a forma como utiliza o site, podem ser tratados:</p>
          <ul>
            <li>o nome, email, telefone e mensagem que forneça voluntariamente num contacto;</li>
            <li>dados necessários para validar o acesso a galerias e manter uma sessão privada;</li>
            <li>favoritos, seleção de fotografias e conteúdo do carrinho guardados no seu navegador;</li>
            <li>email, fotografias selecionadas e dados da encomenda quando a compra está ativa;</li>
            <li>dados técnicos essenciais à segurança, prevenção de abuso e funcionamento do serviço.</li>
          </ul>
        `,
      },
      {
        title: 'Finalidades',
        html: `
          <p>Os dados são utilizados, conforme aplicável, para:</p>
          <ul>
            <li>responder a contactos e prestar os serviços solicitados;</li>
            <li>gerir galerias privadas, sessões, permissões e downloads;</li>
            <li>processar encomendas e pagamentos;</li>
            <li>disponibilizar fotografias adquiridas;</li>
            <li>proteger o site, prevenir utilização abusiva e cumprir obrigações legais.</li>
          </ul>
        `,
      },
      {
        title: 'Base legal',
        html: `
          <p>O tratamento pode basear-se na execução de um contrato ou de diligências solicitadas pelo titular, no consentimento, no cumprimento de obrigações legais ou em interesses legítimos relacionados com a segurança e gestão do serviço, quando aplicável.</p>
        `,
      },
      {
        title: 'Partilha com terceiros',
        html: `
          <p>Os dados são partilhados apenas quando necessário para prestar o serviço ou cumprir obrigações legais. O projeto utiliza atualmente:</p>
          <ul>
            <li><strong>Supabase</strong>, para base de dados, autenticação, funções e armazenamento privado;</li>
            <li><strong>Stripe</strong>, quando uma galeria permite pagamentos;</li>
            <li>o fornecedor de email associado aos contactos e confirmações enviados.</li>
          </ul>
          <p>Estes fornecedores tratam dados de acordo com as respetivas condições e políticas de privacidade.</p>
        `,
      },
      {
        title: 'Pagamentos',
        html: `
          <p>Nas galerias com venda ativa, os pagamentos são processados pela Stripe. O site Fotografia Arnaut não guarda diretamente números completos de cartão, códigos CVV ou outros dados bancários sensíveis introduzidos no checkout.</p>
        `,
      },
      {
        title: 'Cookies e armazenamento local',
        html: `
          <p>A implementação atual não utiliza cookies de publicidade, marketing ou análise comportamental.</p>
          <p>O navegador utiliza armazenamento local e de sessão estritamente necessário para manter o acesso à galeria, favoritos, carrinho, preferências de sessão e ligações de encomendas. Estes dados permanecem no dispositivo até expirarem, serem removidos pelo sistema ou eliminados pelo utilizador.</p>
        `,
      },
      {
        title: 'Armazenamento e segurança',
        html: `
          <p>São utilizadas medidas técnicas e organizativas adequadas ao serviço, incluindo controlo de acesso, autenticação administrativa, armazenamento privado e ligações temporárias para disponibilização de fotografias.</p>
          <p>Nenhum sistema é absolutamente imune a incidentes, mas o acesso é limitado e revisto de acordo com as necessidades operacionais.</p>
        `,
      },
      {
        title: 'Conservação dos dados',
        html: `
          <p>Os dados são conservados apenas durante o período necessário às finalidades para que foram recolhidos e ao cumprimento das obrigações aplicáveis.</p>
          <p>As galerias e os downloads podem ter prazos próprios definidos no serviço. Quando não exista um prazo concreto, a conservação é avaliada em função da relação com o cliente, da segurança e das obrigações legais.</p>
        `,
      },
      {
        title: 'Direitos dos titulares',
        html: `
          <p>Nos termos aplicáveis, pode solicitar o acesso, retificação, apagamento, limitação, oposição ou portabilidade dos seus dados e retirar o consentimento quando o tratamento dependa dele.</p>
          <p>O exercício destes direitos pode estar sujeito a limitações legais e à confirmação da identidade do requerente.</p>
        `,
      },
      {
        title: 'Menores',
        html: `
          <p>As fotografias de eventos podem incluir menores quando tal resulte do serviço contratado e das autorizações aplicáveis. Os pedidos relativos a imagens ou dados de menores devem ser apresentados por quem exerça as respetivas responsabilidades legais.</p>
        `,
      },
      {
        title: 'Alterações à política',
        html: `
          <p>Esta Política pode ser atualizada para refletir alterações legais, técnicas ou dos serviços. A versão mais recente e a data da última atualização permanecem disponíveis nesta página.</p>
        `,
      },
      {
        title: 'Contacto',
        html: `
          <p>Para exercer direitos ou colocar questões sobre privacidade, contacte a Fotografia Arnaut através de <a href="mailto:${SITE_CONTACT_EMAIL}">${SITE_CONTACT_EMAIL}</a>.</p>
          <p>Consulte também os nossos <a href="/termos/">Termos de Utilização</a>.</p>
        `,
      },
    ],
  },
});
